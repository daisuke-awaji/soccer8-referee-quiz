import type { Level, Question, Step } from '../content/schema';

export interface LevelConfig {
  label: string;
  who: string;
  /** 解答前に見直せる回数（Infinity = 何度でも） */
  replays: number;
  slow: boolean;
  hints: boolean;
  points: string[];
}

export const LEVEL_CONFIG: Record<Level, LevelConfig> = {
  beginner: {
    label: '入門',
    who: '保護者審判・はじめての方',
    replays: Infinity,
    slow: true,
    hints: true,
    points: ['何度でも見直せる・スロー再生あり', 'ヒントあり', '用語はタップで説明'],
  },
  grade4: {
    label: '4級',
    who: '4級審判員・ステップアップしたい方',
    replays: 1,
    slow: false,
    hints: false,
    points: ['試合に近づけて、見直しは1回まで', '懲戒（カード）まで判断', '補助審判の問題も追加'],
  },
};

/** そのレベルで出す手順 */
export const stepsFor = (q: Question, level: Level): Step[] => q.steps.filter((s) => !s.levels || s.levels.includes(level));

/** 2D の問題で再生があるか（3D は常にある） */
export function hasAnimation(q: Question): boolean {
  if (q.kind === '3d') return true;
  return q.scene.pauseAt > 0 && !q.scene.static;
}
