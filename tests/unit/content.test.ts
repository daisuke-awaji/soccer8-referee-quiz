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
  it('すべての問題に出典がある', () => {
    for (const q of bundle.questions) expect(q.refs.length).toBeGreaterThan(0);
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
  it('どのステージにも入っていない問題・2つのステージに入っている問題・ない問題', () => {
    const issues = withBrokenCopy((d) => {
      const f = path.join(d, 'stages.yaml');
      edit(f, 'A-01, A-02,', 'A-02, K-01, J-99,');
    });
    expect(issues).toContain('[stages.yaml] 問題「A-01」が、どのステージにも入っていません');
    expect(issues).toContain('[stages.yaml] 問題「K-01」が、ステージ「field」と「kickoff」の両方に入っています');
    expect(issues.some((i) => i.includes('ステージ「field」の問題「J-99」がありません'))).toBe(true);
  });
  it('合図の問題：絵がない／絵の選択肢が一部だけ／ほかの種類で絵の選択肢', () => {
    const issues = withBrokenCopy((d) => {
      edit(path.join(d, 'questions/I-01.yaml'), 'figure: {pose: ref.indirectFreeKick}\n', '');
      edit(path.join(d, 'questions/I-02.yaml'), "        figure: {pose: ref.indirectFreeKick}\n", '');
      edit(path.join(d, 'questions/F-05.yaml'), '      - {id: x, text: 誤り}\n    answer: x', '      - {id: x, text: 誤り, figure: {pose: ref.rest}}\n    answer: x');
    }).join('\n');
    expect(issues).toContain('[I-01] 合図の問題（kind: signal）には、問いの絵（figure）か、絵の選択肢（choices[].figure）が必要です');
    expect(issues).toContain('[I-02] steps[0]: 絵の選択肢は、すべての選択肢に figure を書いてください');
    expect(issues).toContain('[F-05] steps[0]: 絵の選択肢（figure）は kind: signal の問題でのみ使えます');
  });
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
  it('図のない問題に、図に重ねる表示を書いた', () => {
    const issues = withBrokenCopy((d) =>
      edit(path.join(d, 'questions/J-05.yaml'), '  overlays: []', '  overlays:\n    - {type: marker, at: [10, 10]}'),
    );
    expect(issues.join('\n')).toContain('kind: text');
  });
  it('立ち位置の問題：正解が候補にない・候補の id が順でない・対応していないシーン', () => {
    const issues = withBrokenCopy((d) => {
      const f = path.join(d, 'questions/H-04.yaml');
      edit(f, '    answer: C\n', '    answer: E\n');
      edit(f, '      - id: B\n', '      - id: F\n');
      edit(f, 'id: penaltyAreaPush', 'id: slidingTackle');
    }).join('\n');
    expect(issues).toContain('正解「E」が候補にありません');
    expect(issues).toContain('候補の id は A から順に付けてください');
    expect(issues).toContain('立ち位置に対応した3Dシーン');
  });
  it('スキーマ違反（知らない項目）', () => {
    const issues = withBrokenCopy((d) => edit(path.join(d, 'questions/A-02.yaml'), 'title: ', 'titel: x\ntitle: '));
    expect(issues.join('\n')).toMatch(/A-02\.yaml/);
  });
});
