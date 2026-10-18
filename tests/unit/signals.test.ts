import { describe, expect, it } from 'vitest';
import { SIGNAL_POSES } from '../../src/content/schema';
import { GROUND_Y, POSES, VIEW_H, VIEW_W, VIEW_X, VIEW_Y, flagStick, hands, pointedSpot, step, type Pt } from '../../src/signals/poses';

const inside = ([x, y]: Pt, m = 2) => x >= VIEW_X + m && x <= VIEW_X + VIEW_W - m && y >= VIEW_Y + m && y <= VIEW_Y + VIEW_H - m;

describe('合図の絵（poses.ts）', () => {
  it('スキーマのすべての合図に形がある', () => {
    for (const p of SIGNAL_POSES) expect(POSES[p], p).toBeDefined();
  });
  it('手・旗の先・指す点が絵の中に収まる', () => {
    for (const p of SIGNAL_POSES) {
      const s = POSES[p];
      const h = hands(s);
      expect(inside(h.L), `${p} 左手`).toBe(true);
      expect(inside(h.R), `${p} 右手`).toBe(true);
      const f = flagStick(s);
      if (f) {
        expect(inside(f.to), `${p} 旗の先`).toBe(true);
        // 旗の布（棒の先から垂直に 9）も収まる
        expect(inside(step(f.to, f.dir + 90, 9), 0), `${p} 旗の布`).toBe(true);
      }
      const sp = pointedSpot(s);
      if (sp) expect(inside(sp), `${p} 指す点`).toBe(true);
    }
  });
  it('副審の合図は旗を持ち、主審の合図は旗を持たない', () => {
    for (const p of SIGNAL_POSES) expect(!!POSES[p].flag, p).toBe(p.startsWith('ar.'));
  });
  it('オフサイドの位置：近い側は下、中央は水平、遠い側は上を指す', () => {
    const y = (p: 'ar.offsideNear' | 'ar.offsideMiddle' | 'ar.offsideFar') => flagStick(POSES[p])!.to[1];
    expect(y('ar.offsideNear')).toBeGreaterThan(y('ar.offsideMiddle'));
    expect(y('ar.offsideMiddle')).toBeGreaterThan(y('ar.offsideFar'));
  });
  it('間接フリーキック・旗を上げる合図は、手が頭より上', () => {
    expect(hands(POSES['ref.indirectFreeKick']).R[1]).toBeLessThan(12);
    expect(flagStick(POSES['ar.raise'])!.to[1]).toBeLessThan(hands(POSES['ar.raise']).R[1]);
  });
  it('ペナルティーキックの指す点は地面にある', () => {
    expect(pointedSpot(POSES['ref.penaltyKick'])![1]).toBe(GROUND_Y);
  });
});
