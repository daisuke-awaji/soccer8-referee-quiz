import type { Question } from '../content/schema';

/** 再生があるか（3D は常にある。図のない問題にはない） */
export function hasAnimation(q: Question): boolean {
  if (q.kind === '3d') return true;
  if (q.kind === 'text') return false;
  return q.scene.pauseAt > 0 && !q.scene.static;
}
