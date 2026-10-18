/**
 * H-04「クロスの前、PA内で押した」の振り付けと、立ち位置ごとの見え方の判定（three.js に依存しない）。
 * 3D 座標: X = 赤の攻撃方向（青ゴールのゴールラインは X=26）、Z = 横（Z=-25 が副審のいるタッチライン）。
 * 2D のフィールド座標 (x, y) とは X = x - 42, Z = y - 25 で対応する。
 */
import { HIP_H, basePose, blend, clamp, lerp, poseIdle, runPose, smooth, yawOf, type Pose, type XZ } from '../pose';

export const GOAL_LINE_X = 26;
export const BALL_R = 0.17; // 4号球（直径約20cm）より大きめに表示して見やすくする
/** 判定の瞬間（クロスの直前。ここで止めて立ち位置を選ぶ） */
export const PAUSE_T = 2.4;
export const CROSS_T = 2.7;
/** 押した瞬間 */
export const CONTACT_T = 3.3;
export const END_T = 4.6;
/** 主審の目の高さ（大人） */
export const EYE_H = 1.65;
/** 「視野に入る」とみなす、見ている方向からの角度（左右それぞれ） */
export const VIEW_HALF_DEG = 35;
/** ボールのコースからこれより近いと「プレーのじゃまになる」 */
export const PATH_CLEAR_M = 2.5;
/** 人の体を、この半径の円柱とみなして隠れを判定する */
export const BODY_R = 0.17;
export const BODY_H = 1.45;

export const fieldTo3D = ([x, y]: readonly [number, number]): XZ => ({ x: x - 42, z: y - 25 });

const at = (from: XZ, to: XZ, k: number): XZ => ({ x: lerp(from.x, to.x, k), z: lerp(from.z, to.z, k) });
const kOf = (t: number, t0: number, t1: number) => clamp((t - t0) / (t1 - t0), 0, 1);

/* ---------------- 人の動き */

// 青3番が赤9番の後ろについて走り、t=3.05〜3.3 に両手で背中を押す
const B3_PATH: [XZ, XZ] = [{ x: 16.4, z: -4.6 }, { x: 21.2, z: -2.3 }];
const R9_PATH: [XZ, XZ] = [{ x: 17.1, z: -4.8 }, { x: 21.94, z: -2.3 }];
const RUN_END = 3.0;

export function b3At(t: number): XZ {
  return at(B3_PATH[0], B3_PATH[1], smooth(kOf(t, 0, RUN_END)));
}
export function r9At(t: number): XZ {
  const p = at(R9_PATH[0], R9_PATH[1], smooth(kOf(t, 0, RUN_END)));
  // 押されて前へ倒れる
  p.x += 0.75 * smooth(kOf(t, CONTACT_T, CONTACT_T + 0.6));
  return p;
}

/** 押している腕の伸び（0〜1） */
export function pushK(t: number): number {
  if (t < 3.05) return 0;
  if (t < CONTACT_T) return smooth(kOf(t, 3.05, CONTACT_T));
  return 1 - smooth(kOf(t, CONTACT_T + 0.25, CONTACT_T + 0.6));
}
/** 腕を内側に向ける角度（両手が背中の真ん中に来る） */
export const PUSH_ARM_YAW = 0.3;

function jog(path: [XZ, XZ], t: number, T: number, hz: number, amp = 0.6): Pose {
  const k = smooth(kOf(t, 0, T));
  const p = runPose(basePose(), 2 * Math.PI * hz * t, amp * (1 - 0.7 * kOf(t, T - 0.3, T)));
  const q = at(path[0], path[1], k);
  p.x = q.x;
  p.z = q.z;
  p.yaw = yawOf(path[1].x - path[0].x, path[1].z - path[0].z);
  return p;
}

export function poseB3(t: number): Pose {
  const p = jog(B3_PATH, t, RUN_END, 2.2);
  const k = pushK(t);
  if (k > 0) {
    const push = basePose();
    push.shL = push.shR = 1.45;
    push.elL = push.elR = 0.1;
    push.abL = push.abR = 0.05;
    push.lean = -0.18;
    push.kneeL = -0.25;
    push.hipL = 0.35;
    push.hipR = -0.15;
    const o = blend(p, push, k);
    o.x = p.x;
    o.z = p.z;
    o.yaw = 0;
    return o;
  }
  if (t >= RUN_END) p.yaw = lerp(p.yaw, 0, kOf(t, RUN_END - 0.2, 3.05));
  return p;
}

export function poseR9(t: number): Pose {
  const p = jog(R9_PATH, t, RUN_END, 2.4);
  const q = r9At(t);
  p.x = q.x;
  p.z = q.z;
  if (t >= RUN_END) p.yaw = 0;
  const f = smooth(kOf(t, CONTACT_T, CONTACT_T + 0.6));
  if (f > 0) {
    const fallen = basePose();
    fallen.lean = -1.35;
    fallen.y = 0.3;
    fallen.shL = fallen.shR = 2.6;
    fallen.elL = fallen.elR = 0.3;
    fallen.hipL = fallen.hipR = 0.15;
    const o = blend(p, fallen, f);
    o.x = p.x;
    o.z = p.z;
    o.yaw = 0;
    return o;
  }
  return p;
}

const R7_PATH: [XZ, XZ] = [{ x: 8.2, z: -19.0 }, { x: 14.6, z: -19.4 }];
export function poseR7(t: number): Pose {
  const p = jog(R7_PATH, t, CROSS_T, 2.4, 0.75);
  if (t >= CROSS_T - 0.2) {
    // 右足でクロス
    const k = Math.sin(Math.PI * kOf(t, CROSS_T - 0.2, CROSS_T + 0.25));
    p.hipR = lerp(p.hipR, 1.2, k);
    p.kneeR = lerp(p.kneeR, -0.2, k);
    p.shL = lerp(p.shL, -0.9, k);
    p.yaw = lerp(p.yaw, 0.9, smooth(kOf(t, CROSS_T - 0.2, CROSS_T)));
  }
  return p;
}

export const poseB2 = (t: number) => jog([{ x: 12.6, z: -13.6 }, { x: 14.6, z: -17.3 }], t, CROSS_T - 0.1, 2.0);
export const poseR11 = (t: number) => jog([{ x: 15.6, z: 6.4 }, { x: 20.4, z: 3.6 }], t, RUN_END, 2.2);
export const poseB5 = (t: number) => jog([{ x: 16.6, z: 5.2 }, { x: 21.2, z: 4.4 }], t, RUN_END, 2.1);
export function poseGK(t: number): Pose {
  const p = poseIdle({ x: 24.9, z: lerp(-0.2, -1.4, smooth(kOf(t, 1, CROSS_T + 0.3))) }, Math.PI, t);
  // クロスを手で取る
  const k = smooth(kOf(t, 3.55, 3.85));
  p.shL = p.shR = lerp(p.shL, 2.7, k);
  p.elL = p.elR = lerp(p.elL, 0.2, k);
  p.y = lerp(p.y, HIP_H + 0.08, k);
  return p;
}

/** 副審は、後方から2人目の守備側競技者（青3番）のラインにつく */
export function arAt(t: number): XZ {
  return { x: b3At(t).x, z: -25.7 };
}
export function poseAR(t: number): Pose {
  const p = runPose(basePose(), 2 * Math.PI * 1.5 * t, 0.35 * (1 - kOf(t, RUN_END - 0.2, RUN_END + 0.2)));
  const q = arAt(t);
  p.x = q.x;
  p.z = q.z;
  p.yaw = 0;
  return p;
}

/* ---------------- ボール */

const CROSS_FROM: XZ = { x: 15.1, z: -19.4 };
const CROSS_TO: XZ = { x: 21.7, z: -1.6 };
const ARRIVE_T = 3.45;
const GK_HANDS: XZ = { x: 24.65, z: -1.3 };
const CATCH_T = 3.85;

export function ballAt(t: number): { x: number; y: number; z: number } {
  if (t < CROSS_T) {
    const r = jog(R7_PATH, t, CROSS_T, 2.4, 0.75);
    const touch = 0.35 + 0.25 * ((t * 2.4) % 1);
    return { x: r.x + touch, y: BALL_R, z: r.z - 0.03 };
  }
  if (t < ARRIVE_T) {
    const k = kOf(t, CROSS_T, ARRIVE_T);
    const q = at(CROSS_FROM, CROSS_TO, k);
    return { x: q.x, y: BALL_R + 4 * 3.0 * k * (1 - k) + 2.0 * k, z: q.z };
  }
  if (t < CATCH_T) {
    const k = kOf(t, ARRIVE_T, CATCH_T);
    const q = at(CROSS_TO, GK_HANDS, k);
    return { x: q.x, y: lerp(BALL_R + 2.0, 1.75, k), z: q.z };
  }
  return { x: GK_HANDS.x, y: 1.75, z: GK_HANDS.z };
}

/* ---------------- 見え方の判定 */

export interface ViewCheck {
  /** 押している手が見える（ほかの選手の体に隠れない） */
  handsVisible: boolean;
  /** 副審が視野に入る */
  arInView: boolean;
  /** プレー（ボールのコース）のじゃまにならない */
  clearOfPlay: boolean;
  /** 押した位置を見たときの、副審の方向との角度（度） */
  arAngle: number;
  /** ボールのコースまでの距離（m） */
  pathDist: number;
}

/** 押した瞬間の、両手の位置 */
export function handPoints(t = CONTACT_T): Array<{ x: number; y: number; z: number }> {
  const b = b3At(t);
  return [-0.05, 0.05].map((dz) => ({ x: b.x + 0.52, y: 1.15, z: b.z + dz }));
}
export function pushPoint(t = CONTACT_T): { x: number; y: number; z: number } {
  const b = b3At(t);
  return { x: b.x + 0.52, y: 1.1, z: b.z };
}

/** 隠れの判定に使う体（主審・副審以外の選手） */
export function bodiesAt(t: number): XZ[] {
  const pos = (p: Pose): XZ => ({ x: p.x, z: p.z });
  return [b3At(t), r9At(t), pos(poseR7(t)), pos(poseB2(t)), pos(poseR11(t)), pos(poseB5(t)), pos(poseGK(t))];
}

/** 目 e から点 p への線分が、円柱（中心 c・半径 r・高さ 0〜h）を通るか */
export function segmentHitsCylinder(e: { x: number; y: number; z: number }, p: { x: number; y: number; z: number }, c: XZ, r: number, h: number): boolean {
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const L2 = dx * dx + dz * dz;
  if (L2 < 1e-9) return false;
  const s = clamp(((c.x - e.x) * dx + (c.z - e.z) * dz) / L2, 0, 1);
  const qx = e.x + dx * s - c.x;
  const qz = e.z + dz * s - c.z;
  if (qx * qx + qz * qz > r * r) return false;
  const y = lerp(e.y, p.y, s);
  return y >= 0 && y <= h;
}

function distToSegment(p: XZ, a: XZ, b: XZ): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const s = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(a.x + dx * s - p.x, a.z + dz * s - p.z);
}

const angleDeg = (a: XZ, b: XZ) => {
  const d = Math.atan2(b.z, b.x) - Math.atan2(a.z, a.x);
  return Math.abs((((d * 180) / Math.PI + 540) % 360) - 180);
};

/** 主審が eye（3D 座標）に立ったときの見え方 */
export function viewCheck(eye: XZ, t = CONTACT_T): ViewCheck {
  const e = { x: eye.x, y: EYE_H, z: eye.z };
  const bodies = bodiesAt(t);
  const handsVisible = handPoints(t).some((h) => !bodies.some((b) => segmentHitsCylinder(e, h, b, BODY_R, BODY_H)));
  const pp = pushPoint(t);
  const ar = arAt(t);
  const arAngle = angleDeg({ x: pp.x - e.x, z: pp.z - e.z }, { x: ar.x - e.x, z: ar.z - e.z });
  const pathDist = Math.min(distToSegment(eye, CROSS_FROM, CROSS_TO), distToSegment(eye, CROSS_TO, GK_HANDS));
  return { handsVisible, arInView: arAngle <= VIEW_HALF_DEG, clearOfPlay: pathDist >= PATH_CLEAR_M, arAngle, pathDist };
}

export const viewOk = (v: ViewCheck) => v.handsVisible && v.arInView && v.clearOfPlay;

/** 解説用：ボールのコース（地面に投影） */
export const CROSS_PATH: XZ[] = [CROSS_FROM, CROSS_TO, GK_HANDS];
