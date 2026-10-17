import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_DIR, loadContent } from '../../plugins/content';
import { ballGapAtContact } from '../../src/scene3d/scenes/slidingTackleMotion';

describe('content（リポジトリの問題データ）', () => {
  const { bundle, issues } = loadContent();
  it('検査で問題が見つからない', () => {
    expect(issues).toEqual([]);
  });
  it('すべての問題に出典があり、両方のレベルで1問以上ある', () => {
    for (const q of bundle.questions) expect(q.refs.length).toBeGreaterThan(0);
    expect(bundle.questions.some((q) => q.levels.includes('beginner'))).toBe(true);
    expect(bundle.questions.some((q) => q.levels.includes('grade4'))).toBe(true);
  });
  it('H-01：接触の瞬間、ボールは足から2m以上前にある（解説の前提）', () => {
    expect(ballGapAtContact()).toBeGreaterThan(2);
  });
});

/** 一時フォルダにコピーした問題データを壊して、検査が見つけることを確かめる */
function withBrokenCopy(mutate: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ref8-content-'));
  fs.cpSync(CONTENT_DIR, dir, { recursive: true });
  try {
    mutate(dir);
    return loadContent(dir).issues.map((i) => `[${i.where}] ${i.message}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const edit = (file: string, from: string | RegExp, to: string) => {
  const s = fs.readFileSync(file, 'utf8');
  const out = s.replace(from, to);
  if (out === s) throw new Error(`置き換え対象がありません: ${from}`);
  fs.writeFileSync(file, out);
};

describe('content の検査は壊れたデータを見つける', () => {
  it('正解が選択肢にない', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), 'answer: m7', 'answer: m8'));
    expect(issues.join('\n')).toContain('正解「m8」が選択肢にありません');
  });
  it('出典が sources.yaml にない', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), 'src: eight', 'src: unknown'));
    expect(issues.join('\n')).toContain('出典「unknown」');
  });
  it('用語集にない用語', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), '{{クイックリスタート}}', '{{ないもの}}'));
    expect(issues.join('\n')).toContain('用語「ないもの」');
  });
  it('キーフレームの時刻が逆順', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/D-01.yaml'), '- t: 1.2', '- t: 9.9'));
    expect(issues.join('\n')).toContain('より前です');
  });
  it('登場人物が定義されていない', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/D-01.yaml'), 'actor: B5', 'actor: B99'));
    expect(issues.join('\n')).toContain('「B99」が actors にありません');
  });
  it('ファイル名と ID が違う', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), 'id: A-02', 'id: A-09'));
    expect(issues.join('\n')).toContain('ファイル名は「A-09.yaml」');
  });
  it('スキーマ違反（知らない項目）', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), 'title: ', 'titel: x\ntitle: '));
    expect(issues.join('\n')).toMatch(/A-02\.yaml/);
  });
});
