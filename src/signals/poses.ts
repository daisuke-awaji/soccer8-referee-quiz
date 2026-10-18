/**
 * 合図の絵の形（DOM に依存しない）。審判員を正面（または横）から見た棒人形で描く。
 *
 * 角度は画面の向き（度）: 0 = 絵の右、90 = 上、-90 = 下、180 = 左。
 * 正面の絵の「左腕・右腕」は、見ている人から見た左右（armL = 絵の左側の腕）。
 * 第5条・第6条の「承認されているシグナル」の図に合わせる。
 */
import type { SignalPose } from '../content/schema';

export interface Arm {
  /** 肩から手までの向き */
  dir: number;
  /** 長さ（既定 29）。前に出した腕など、短く見せるときに使う */
  len?: number;
}

export interface PoseShape {
  /** 横から見た絵（右を向く）。腕は両方とも同じ肩から出る */
  side?: boolean;
  armL: Arm;
  armR: Arm;
  /** 旗を持つ手。both = 両手で頭の上に横にして持つ（交代） */
  flag?: 'L' | 'R' | 'both';
  /** 旗の棒の向き（既定は旗を持つ腕と同じ向き＝伸ばした腕の延長） */
  flagDir?: number;
  /** 指を開いた手（カウントダウン） */
  openHand?: boolean;
  /** 旗を左右に振っている（動きの線） */
  wave?: boolean;
  /** 指している地面の点（ペナルティーマーク） */
  spot?: boolean;
}

const REST_L: Arm = { dir: -110 };
const REST_R: Arm = { dir: -70 };

export const POSES: Readonly<Record<SignalPose, PoseShape>> = {
  'ref.rest': { armL: REST_L, armR: REST_R },
  'ref.indirectFreeKick': { armL: REST_L, armR: { dir: 88 } },
  'ref.directFreeKick': { armL: REST_L, armR: { dir: 12 } },
  'ref.advantage': { side: true, armL: { dir: -8 }, armR: { dir: -14 } },
  'ref.penaltyKick': { armL: REST_L, armR: { dir: -66 }, spot: true },
  'ref.cornerKick': { armL: REST_L, armR: { dir: 40 } },
  'ref.goalKick': { armL: REST_L, armR: { dir: -15 } },
  'ref.countdown': { armL: REST_L, armR: { dir: 80 }, openHand: true },
  'ar.rest': { armL: REST_L, armR: REST_R, flag: 'R', flagDir: -90 },
  'ar.raise': { armL: REST_L, armR: { dir: 88 }, flag: 'R' },
  'ar.direction': { armL: REST_L, armR: { dir: 45 }, flag: 'R' },
  'ar.cornerKick': { armL: REST_L, armR: { dir: -40 }, flag: 'R' },
  'ar.goalKick': { armL: REST_L, armR: { dir: 0 }, flag: 'R' },
  'ar.substitution': { armL: { dir: 105, len: 26 }, armR: { dir: 75, len: 26 }, flag: 'both' },
  'ar.wave': { armL: REST_L, armR: { dir: 80 }, flag: 'R', wave: true },
  'ar.offsideNear': { side: true, armL: { dir: -100 }, armR: { dir: -40 }, flag: 'R' },
  'ar.offsideMiddle': { side: true, armL: { dir: -100 }, armR: { dir: 0 }, flag: 'R' },
  'ar.offsideFar': { side: true, armL: { dir: -100 }, armR: { dir: 40 }, flag: 'R' },
};

export const isAssistantPose = (p: SignalPose) => p.startsWith('ar.');

/* ---------- 形の計算 */
export type Pt = readonly [number, number];
/** 絵の範囲（上に上げた旗・横に伸ばした旗が収まるよう、人物の外側に余白をとる） */
export const VIEW_X = -16;
export const VIEW_Y = -26;
export const VIEW_W = 152;
export const VIEW_H = 158;
export const GROUND_Y = 126;
const ARM_LEN = 29;
const FLAG_STICK = 20;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** 画面の角度 → SVG の座標（y は下向き） */
export const step = (from: Pt, deg: number, len: number): Pt => [from[0] + Math.cos(rad(deg)) * len, from[1] - Math.sin(rad(deg)) * len];

export function shoulders(shape: PoseShape): { L: Pt; R: Pt } {
  return shape.side ? { L: [60, 37], R: [60, 37] } : { L: [48, 37], R: [72, 37] };
}

export function hands(shape: PoseShape): { L: Pt; R: Pt } {
  const s = shoulders(shape);
  return {
    L: step(s.L, shape.armL.dir, shape.armL.len ?? ARM_LEN),
    R: step(s.R, shape.armR.dir, shape.armR.len ?? ARM_LEN),
  };
}

/** 旗の棒（手元 → 先端）。持たない絵は null */
export function flagStick(shape: PoseShape): { from: Pt; to: Pt; dir: number } | null {
  if (!shape.flag) return null;
  const h = hands(shape);
  if (shape.flag === 'both') return { from: h.L, to: h.R, dir: 0 };
  const hand = shape.flag === 'L' ? h.L : h.R;
  const arm = shape.flag === 'L' ? shape.armL : shape.armR;
  const dir = shape.flagDir ?? arm.dir;
  return { from: hand, to: step(hand, dir, FLAG_STICK), dir };
}

/** 指している向きの先の、地面の点（ペナルティーマーク） */
export function pointedSpot(shape: PoseShape): Pt | null {
  if (!shape.spot) return null;
  const s = shoulders(shape).R;
  const d = rad(shape.armR.dir);
  const t = (GROUND_Y - s[1]) / -Math.sin(d);
  return [s[0] + Math.cos(d) * t, GROUND_Y];
}
