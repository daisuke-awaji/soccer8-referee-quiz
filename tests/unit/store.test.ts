import { describe, expect, it } from 'vitest';
import { defaultState, migrate } from '../../src/storage/store';
import { finishPatch, isInProgress, startStagePatch, summarize } from '../../src/engine/session';
import { loadContent } from '../../plugins/content';
import { parseDirectLink } from '../../src/app/route';

const { bundle } = loadContent();
const QMAP = Object.fromEntries(bundle.questions.map((q) => [q.id, q]));
const STAGE_MAP = Object.fromEntries(bundle.stages.map((s) => [s.id, s]));
const stage = bundle.stages[0]!;

describe('migrate（保存形式の引き継ぎ）', () => {
  it('壊れた値や空なら初期値', () => {
    expect(migrate(null)).toEqual(defaultState());
    expect(migrate('x')).toEqual(defaultState());
  });
  it('試作版 v0.1 の保存内容を引き継ぐ', () => {
    const v1 = {
      level: 'grade4',
      order: ['A-01', 'A-02'],
      idx: 1,
      results: { 'A-01': { ok: true, n: 1, total: 1, at: 1 } },
      ratings: { 'A-01': 'good' },
      notes: 'メモ',
      settings: { sound: false, haptics: true },
      round: 'main',
      finished: false,
    };
    const s = migrate(v1, new Set(['A-01', 'A-02']));
    expect(s.version).toBe(3);
    expect(s).not.toHaveProperty('level');
    // 全問を通して解く形だったので、途中の出題は引き継がない
    expect(s.order).toEqual([]);
    expect(s.stage).toBeNull();
    expect(s.results['A-01']?.ok).toBe(true);
    expect(s.settings.sound).toBe(false);
    expect(s.notes).toBe('メモ');
    expect(s).not.toHaveProperty('ratings');
  });
  it('v3 の途中のステージを引き継ぐ', () => {
    const raw = { version: 3, stage: 'field', order: ['A-01', 'A-02'], idx: 1, results: {}, stageScores: { field: { score: 3, total: 10, at: 1 } } };
    const s = migrate(raw, new Set(['A-01', 'A-02']), new Set(['field']));
    expect(s).toMatchObject({ stage: 'field', idx: 1, order: ['A-01', 'A-02'] });
    expect(s.stageScores.field?.score).toBe(3);
  });
  it('なくなったステージは、途中の出題と記録を消す', () => {
    const raw = { version: 3, stage: 'old', order: ['A-01'], idx: 0, results: {}, stageScores: { old: { score: 1, total: 1, at: 1 } } };
    const s = migrate(raw, new Set(['A-01']), new Set(['field']));
    expect(s.stage).toBeNull();
    expect(s.order).toEqual([]);
    expect(s.stageScores).toEqual({});
  });
  it('なくなった問題が出題中なら、出題をやめる（成績は残す）', () => {
    const s = migrate({ version: 3, stage: 'field', order: ['A-01', 'Z-99'], idx: 1, results: { 'A-01': { ok: true, at: 1 } } }, new Set(['A-01']));
    expect(s.order).toEqual([]);
    expect(s.idx).toBe(0);
    expect(Object.keys(s.results)).toEqual(['A-01']);
  });
});

describe('session', () => {
  it('ステージの問題を、ステージ表の順に出す', () => {
    const p = startStagePatch(stage, defaultState());
    expect(p.stage).toBe(stage.id);
    expect(p.order).toEqual(stage.questions);
    expect(p.idx).toBe(0);
  });
  it('間違えた問題の解き直しでは、前の成績を残す', () => {
    const prev = { ...defaultState(), results: { 'A-01': { ok: false, at: 1 } } };
    expect(startStagePatch(stage, prev, ['A-01'], 'retry').results).toEqual(prev.results);
    expect(startStagePatch(stage, prev).results).toEqual({});
  });
  it('終えたら、ステージ全体の正解数を記録する（とばした問題は不正解と同じ）', () => {
    const [a, b, c] = stage.questions;
    const s = {
      ...defaultState(),
      ...startStagePatch(stage, defaultState()),
      results: { [a!]: { ok: true, at: 1 }, [b!]: { ok: false, at: 1 }, [c!]: { skipped: true, at: 1 } },
    };
    const p = finishPatch(s, STAGE_MAP);
    expect(p.finished).toBe(true);
    expect(p.stageScores?.[stage.id]).toMatchObject({ score: 1, total: stage.questions.length });
  });
  it('集計：とばした問題は数えない', () => {
    const sum = summarize(
      ['A-01', 'A-02', 'B-01'],
      { 'A-01': { ok: true, at: 1 }, 'A-02': { ok: false, at: 1 }, 'B-01': { skipped: true, at: 1 } },
      QMAP,
    );
    expect(sum).toMatchObject({ score: 1, total: 2, wrong: ['A-02'] });
    expect(sum.categories).toEqual([{ category: 'basics', ok: 1, n: 2 }]);
  });
  it('途中かどうか', () => {
    expect(isInProgress(defaultState())).toBe(false);
    expect(isInProgress({ ...defaultState(), stage: 'field', order: ['A-01'], idx: 0, results: { 'A-01': { ok: true, at: 1 } } })).toBe(true);
  });
});

describe('parseDirectLink', () => {
  it('新しい形式と試作版の形式の両方を読む', () => {
    expect(parseDirectLink('#/q/A-01')).toEqual({ id: 'A-01' });
    expect(parseDirectLink('#q=D-01')).toEqual({ id: 'D-01' });
    // 以前のレベル指定が付いたリンクも開ける
    expect(parseDirectLink('#/q/H-01?lv=grade4')).toEqual({ id: 'H-01' });
    expect(parseDirectLink('#q=D-01&lv=beginner')).toEqual({ id: 'D-01' });
    expect(parseDirectLink('#/')).toBeNull();
  });
});
