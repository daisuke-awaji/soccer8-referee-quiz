import { describe, expect, it } from 'vitest';
import type { Placement } from '../../src/content/schema';
import { describePlacement, judgePlacement } from '../../src/engine/placement';

const free: Placement = {
  mode: 'free',
  target: [60, 25],
  tolerance: 1,
  describe: { kind: 'distanceFromGoalLine', answerText: '8m' },
  zones: [{ at: [57, 25], r: 0.9, text: '11人制の距離' }, { lineX: 56, r: 0.6, text: 'PAのライン' }],
};
const line: Placement = {
  mode: 'line',
  actor: 'AR2',
  fixedY: 51.4,
  min: 34.5,
  max: 68,
  target: [57.5, 51.4],
  tolerance: 1.5,
  describe: { kind: 'lineOffset' },
  zones: [],
};

describe('judgePlacement', () => {
  it('許容範囲（円）の中なら正解、境界も正解', () => {
    expect(judgePlacement(free, [60.5, 25.5]).ok).toBe(true);
    expect(judgePlacement(free, [61, 25]).ok).toBe(true);
    expect(judgePlacement(free, [61.01, 25]).ok).toBe(false);
  });
  it('よくある間違いの位置なら、その説明を返す', () => {
    expect(judgePlacement(free, [57.2, 25]).note).toBe('11人制の距離');
    expect(judgePlacement(free, [56.2, 10]).note).toBe('PAのライン');
    expect(judgePlacement(free, [45, 10]).note).toBe('');
  });
  it('正解なら間違いの説明は出さない', () => {
    expect(judgePlacement(free, [60, 25]).note).toBe('');
  });
  it('ライン上の配置は x の差だけで判定する', () => {
    expect(judgePlacement(line, [58.9, 0]).ok).toBe(true);
    expect(judgePlacement(line, [59.1, 51.4]).ok).toBe(false);
    expect(judgePlacement(line, [59.1, 51.4]).distance).toBeCloseTo(1.6);
  });
});

describe('describePlacement', () => {
  it('ゴールラインからの距離を小数1桁で示す', () => {
    expect(describePlacement(free, [57, 25])).toBe('あなたの位置：ゴールラインから約11.0m（正解は8m。±1m以内を正解としています）');
  });
  it('ラインのずれの向きを示す', () => {
    expect(describePlacement(line, [60.5, 51.4])).toBe('正解のラインから3.0m ゴール寄りです（±1.5m以内を正解としています）');
    expect(describePlacement(line, [50, 51.4])).toContain('センター寄り');
    expect(describePlacement(line, [57, 51.4])).toContain('ほぼ同じ位置');
  });
});
