import { describe, expect, it } from 'vitest';
import { captionAt, compileTimeline, positionAt, toScreen } from '../../src/pitch2d/timeline';

const tl = compileTimeline([
  { t: 0, positions: { A: [0, 0], B: [10, 10] }, events: [{ type: 'caption', text: 'はじめ' }] },
  { t: 2, positions: { A: [10, 20] }, events: [{ type: 'whistle' }] },
  { t: 4, positions: {}, events: [{ type: 'caption', text: 'おわり' }] },
]);

describe('timeline', () => {
  it('キーフレームの間を線形補間し、範囲の外は端の位置にとどまる', () => {
    expect(positionAt(tl.tracks.A, 1)).toEqual([5, 10]);
    expect(positionAt(tl.tracks.A, -1)).toEqual([0, 0]);
    expect(positionAt(tl.tracks.A, 3)).toEqual([10, 20]);
    expect(positionAt(tl.tracks.B, 3)).toEqual([10, 10]);
    expect(positionAt(tl.tracks.C, 1)).toBeNull();
  });
  it('長さは最後のキーフレームの時刻', () => {
    expect(tl.duration).toBe(4);
  });
  it('字幕はその時刻までに出た最後のもの', () => {
    expect(captionAt(tl.events, 0)).toBe('はじめ');
    expect(captionAt(tl.events, 3.9)).toBe('はじめ');
    expect(captionAt(tl.events, 4)).toBe('おわり');
  });
  it('赤チームが画面の上へ攻めるように回転する', () => {
    expect(toScreen(68, 0)).toEqual([0, 0]);
    expect(toScreen(0, 50)).toEqual([50, 68]);
  });
});
