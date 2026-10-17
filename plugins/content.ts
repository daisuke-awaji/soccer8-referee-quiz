/**
 * content/ 以下の YAML を読み込み、スキーマと整合性を検査する（Node 専用）。
 * - Vite プラグイン: `import content from 'virtual:content'` で検査済みのデータを渡す。
 *   検査に失敗するとビルドは失敗し、開発サーバーではエラー画面が出る。
 * - scripts/content-check.ts とテストからも使う。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { Plugin } from 'vite';
import { z } from 'zod';
import { Categories, Glossary, Question, Sources, Stages } from '../src/content/schema.ts';
import { validateContent, type ContentBundle, type ContentIssue } from '../src/content/validate.ts';

export const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');

export interface LoadResult {
  bundle: ContentBundle;
  issues: ContentIssue[];
  files: string[];
}

function formatZodError(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function readYaml(file: string): unknown {
  return parse(fs.readFileSync(file, 'utf8'));
}

export function loadContent(dir: string = CONTENT_DIR): LoadResult {
  const issues: ContentIssue[] = [];
  const files: string[] = [];
  const rel = (f: string) => path.relative(dir, f);

  function load<T>(file: string, schema: z.ZodType<T>, fallback: T): T {
    files.push(file);
    if (!fs.existsSync(file)) {
      issues.push({ where: rel(file), message: 'ファイルがありません' });
      return fallback;
    }
    const r = schema.safeParse(readYaml(file));
    if (!r.success) {
      for (const m of formatZodError(r.error)) issues.push({ where: rel(file), message: m });
      return fallback;
    }
    return r.data;
  }

  const sources = load(path.join(dir, 'sources.yaml'), Sources, {});
  const glossary = load(path.join(dir, 'glossary.yaml'), Glossary, {});
  const categories = load(path.join(dir, 'categories.yaml'), Categories, {} as Categories);
  const stages = load(path.join(dir, 'stages.yaml'), Stages, []);

  const qdir = path.join(dir, 'questions');
  const questions: Question[] = [];
  const names = fs.existsSync(qdir) ? fs.readdirSync(qdir).filter((n) => n.endsWith('.yaml')).sort() : [];
  for (const name of names) {
    const file = path.join(qdir, name);
    files.push(file);
    let raw: unknown;
    try {
      raw = readYaml(file);
    } catch (e) {
      issues.push({ where: rel(file), message: `YAML の書き方が正しくありません: ${(e as Error).message}` });
      continue;
    }
    const r = Question.safeParse(raw);
    if (!r.success) {
      for (const m of formatZodError(r.error)) issues.push({ where: rel(file), message: m });
      continue;
    }
    if (r.data.id + '.yaml' !== name) issues.push({ where: rel(file), message: `ファイル名は「${r.data.id}.yaml」にしてください` });
    questions.push(r.data);
  }

  const bundle: ContentBundle = { questions, sources, glossary, categories, stages };
  issues.push(...validateContent(bundle));
  return { bundle, issues, files };
}

export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((i) => `  - [${i.where}] ${i.message}`).join('\n');
}

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export function contentPlugin(dir: string = CONTENT_DIR): Plugin {
  return {
    name: 'ref8-content',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { bundle, issues, files } = loadContent(dir);
      for (const f of files) this.addWatchFile(f);
      this.addWatchFile(path.join(dir, 'questions'));
      if (issues.length) throw new Error(`問題データに ${issues.length} 件の問題があります:\n${formatIssues(issues)}`);
      return `export default ${JSON.stringify(bundle)};`;
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.startsWith(dir)) return;
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) {
        ctx.server.moduleGraph.invalidateModule(mod);
        ctx.server.ws.send({ type: 'full-reload' });
      }
      return [];
    },
  };
}
