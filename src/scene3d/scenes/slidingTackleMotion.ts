/**
 * H-01「横からのスライディングタックル」の振り付け（three.js に依存しない）。
 * 青ゴールのゴールラインは x=26。赤10番は +X 方向へドリブルし、青4番が左前方から滑り込む。
 */
import { HIP_H, basePose, blend, clamp, lerp, runPose, smooth, yawOf, type Pose } from '../pose';

/** 接触の瞬間（秒） */
export const CONTACT_T = 1.6;
export const BALL_R = 0.17; // 4号球（直径約20cm）より大きめに表示して見やすくする
export const BALL_Z = 0.06;
export const GOAL_LINE_X = 26;

/** ボールの位置。最後のタッチは t=1.1、初速 9m/s、減速 2.4m/s² */
export function ballX(t: number): number {
  const t0 = 1.1;
  if (t <= t0) return 5 * t + 0.52 + 0.3 * ((t * 2.5) % 1);
  const b0 = 5 * t0 + 0.52 + 0.3 * ((t0 * 2.5) % 1);
  const dt = Math.min(t - t0, 9 / 2.4);
  return b0 + 9 * dt - 1.2 * dt * dt;
}

/** 接触時の赤10番の右足（軸足） */
export const ATTACKER_FOOT = { x: 5 * CONTACT_T, y: 0.2, z: 0.09 };

/** 接触の瞬間に、ボールが足から何 m 前にあるか */
export const ballGapAtContact = () => ballX(CONTACT_T) - ATTACKER_FOOT.x;

// 青4番のスライディング経路
const D_P0 = { x: 1.5, z: 7.5 };
const D_P1 = { x: 6.0, z: 2.3 };
const D_DIR = (() => {
  const dx = ATTACKER_FOOT.x - D_P1.x;
  const dz = ATTACKER_FOOT.z - D_P1.z;
  const n = Math.hypot(dx, dz);
  return { x: dx / n, z: dz / n };
})();
const D_RIGHT = { x: -D_DIR.z, z: D_DIR.x };
const REACH = 0.72 + 0.15;
const D_PC = {
  x: ATTACKER_FOOT.x - D_DIR.x * REACH - D_RIGHT.x * 0.09,
  z: ATTACKER_FOOT.z - D_DIR.z * REACH - D_RIGHT.z * 0.09,
};
const D_PE = { x: D_PC.x + D_DIR.x * 0.7, z: D_PC.z + D_DIR.z * 0.7 };

export function poseAttacker(t: number): Pose {
  const p = basePose();
  if (t <= CONTACT_T) {
    runPose(p, 2 * Math.PI * 2.5 * t, 1);
    p.x = 5 * t;
    p.z = 0;
    p.yaw = 0;
    return p;
  }
  const dt = t - CONTACT_T;
  const k = clamp(dt / 0.75, 0, 1);
  const e = k * k;
  runPose(p, 0, 1 - k);
  const dd = Math.min(dt, 1.0);
  p.x = 5 * CONTACT_T + 4.4 * dd - 1.9 * dd * dd;
  p.z = 0.05 * k;
  p.yaw = 0.08 * k;
  p.lean = lerp(-0.14, -1.47, e);
  p.y = lerp(HIP_H, 0.17, e);
  p.hipR = lerp(0, -0.75, smooth(clamp(dt / 0.3, 0, 1)));
  p.kneeR = lerp(-0.12, -1.1, smooth(clamp(dt / 0.35, 0, 1)));
  p.hipL = lerp(0, 0.35, k);
  p.kneeL = lerp(-1.2, -0.5, k);
  p.shL = p.shR = lerp(0.3, 2.7, smooth(clamp(dt / 0.45, 0, 1)));
  p.elL = p.elR = lerp(1.2, 0.35, k);
  p.abL = p.abR = lerp(0.1, 0.35, k);
  if (dt > 1.2) {
    const k2 = smooth(clamp((dt - 1.2) / 0.5, 0, 1));
    p.kneeR = lerp(p.kneeR, -1.9, k2);
    p.hipR = lerp(p.hipR, -0.3, k2);
  }
  return p;
}

function slidePose(): Pose {
  return Object.assign(basePose(), {
    y: 0.25, lean: 0.9, hipR: 0.7, kneeR: 0, ankR: -0.1, hipL: 0.45, kneeL: -2.45, ankL: 0.9,
    shL: -0.95, elL: 0.2, abL: 0.4, shR: 0.55, elR: 0.6, abR: 0.35,
  });
}

export function poseDefender(t: number): Pose {
  const yawRun = yawOf(D_P1.x - D_P0.x, D_P1.z - D_P0.z);
  const yawSlide = yawOf(D_DIR.x, D_DIR.z);
  if (t <= 1.2) {
    const p = runPose(basePose(), 2 * Math.PI * 2.7 * t, 1);
    const k = t / 1.2;
    p.x = lerp(D_P0.x, D_P1.x, k);
    p.z = lerp(D_P0.z, D_P1.z, k);
    p.yaw = lerp(yawRun, yawSlide, smooth(clamp((t - 0.9) / 0.3, 0, 1)));
    return p;
  }
  let p: Pose;
  if (t <= 1.33) {
    const run = runPose(basePose(), 2 * Math.PI * 2.7 * t, 1);
    p = blend(run, slidePose(), smooth((t - 1.2) / 0.13));
  } else p = slidePose();
  p.yaw = yawSlide;
  if (t <= CONTACT_T) {
    const k = (t - 1.2) / (CONTACT_T - 1.2);
    p.x = lerp(D_P1.x, D_PC.x, k);
    p.z = lerp(D_P1.z, D_PC.z, k);
  } else {
    const k = 1 - Math.pow(1 - clamp((t - CONTACT_T) / 0.5, 0, 1), 2);
    p.x = lerp(D_PC.x, D_PE.x, k);
    p.z = lerp(D_PC.z, D_PE.z, k);
    if (t > 2.1) {
      const k2 = smooth(clamp((t - 2.1) / 0.6, 0, 1));
      p.lean = lerp(0.9, 0.35, k2);
      p.hipR = lerp(0.7, 1.65, k2);
      p.kneeR = lerp(0, -1.2, k2);
      p.hipL = lerp(0.45, 0.95, k2);
      p.shL = lerp(-0.95, -0.35, k2);
      p.y = lerp(0.25, 0.22, k2);
    }
  }
  return p;
}
