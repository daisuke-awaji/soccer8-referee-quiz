/**
 * 3D の人物の姿勢（関節の角度）と、走る・立つなどの基本の動き。three.js に依存しない。
 * 座標: X = 攻撃方向, Y = 上, Z = 横
 */
export const HIP_H = 0.74; // 骨盤の高さ（U-12 想定 身長約1.5m）

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (k: number) => k * k * (3 - 2 * k);

export const POSE_KEYS = [
  'x', 'z', 'y', 'yaw', 'lean', 'roll',
  'hipL', 'kneeL', 'ankL', 'hipR', 'kneeR', 'ankR',
  'shL', 'elL', 'shR', 'elR', 'abL', 'abR',
] as const;
export type Pose = Record<(typeof POSE_KEYS)[number], number>;

export function basePose(): Pose {
  return {
    x: 0, z: 0, y: HIP_H, yaw: 0, lean: 0, roll: 0,
    hipL: 0, kneeL: -0.05, ankL: 0, hipR: 0, kneeR: -0.05, ankR: 0,
    shL: 0, elL: 0.25, shR: 0, elR: 0.25, abL: 0.1, abR: 0.1,
  };
}

export function blend(a: Pose, b: Pose, k: number): Pose {
  const o = basePose();
  for (const key of POSE_KEYS) o[key] = lerp(a[key], b[key], k);
  return o;
}

/** 走る動き。phase は足の周期（ラジアン）、amp は大きさ（0〜1） */
export function runPose(p: Pose, phase: number, amp: number): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  p.hipL = amp * 0.75 * s;
  p.hipR = -amp * 0.75 * s;
  p.kneeL = -(0.12 + amp * 1.1 * Math.max(0, c));
  p.kneeR = -(0.12 + amp * 1.1 * Math.max(0, -c));
  p.shL = -amp * 0.7 * s;
  p.shR = amp * 0.7 * s;
  p.elL = p.elR = 1.2;
  p.y = HIP_H - 0.035 + 0.035 * Math.abs(c);
  p.lean = -0.14 * amp;
  return p;
}

export const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);

export interface XZ {
  x: number;
  z: number;
}

/** from から to へ T 秒かけて軽く走る */
export function poseJog(from: XZ, to: XZ, t: number, T: number, speedHz: number): Pose {
  const k = clamp(t / T, 0, 1);
  const p = runPose(basePose(), 2 * Math.PI * speedHz * t, 0.55);
  p.x = lerp(from.x, to.x, k);
  p.z = lerp(from.z, to.z, k);
  p.yaw = yawOf(to.x - from.x, to.z - from.z);
  return p;
}

/** 構えて立つ（GK など） */
export function poseIdle(at: XZ, yaw: number, t: number): Pose {
  const p = basePose();
  p.x = at.x;
  p.z = at.z;
  p.yaw = yaw;
  p.kneeL = p.kneeR = -0.35;
  p.hipL = p.hipR = 0.25;
  p.y = HIP_H - 0.05;
  p.lean = -0.2;
  p.shL = p.shR = 0.3;
  p.abL = p.abR = 0.35;
  p.elL = p.elR = 0.6;
  p.z += Math.sin(t * 2.2) * 0.12;
  return p;
}
