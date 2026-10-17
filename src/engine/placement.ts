/** 配置問題の採点と説明文（DOM に依存しない） */
import type { Placement, Vec2 } from '../content/schema';
import { PITCH_LENGTH } from '../pitch2d/timeline';

export interface PlacementJudgement {
  ok: boolean;
  /** 正解との距離（m） */
  distance: number;
  /** よくある間違いに当てはまったときの説明 */
  note: string;
  /** 「あなたの位置：…」などの説明 */
  desc: string;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function placementDistance(cfg: Placement, p: Vec2): number {
  return cfg.mode === 'line' ? Math.abs(p[0] - cfg.target[0]) : Math.hypot(p[0] - cfg.target[0], p[1] - cfg.target[1]);
}

export function describePlacement(cfg: Placement, p: Vec2): string {
  const d = cfg.describe;
  if (!d) return '';
  const tol = `±${cfg.tolerance}m以内を正解としています`;
  switch (d.kind) {
    case 'distanceFromGoalLine':
      return `あなたの位置：ゴールラインから約${fmt(PITCH_LENGTH - p[0])}m（正解は${d.answerText}。${tol}）`;
    case 'lineOffset': {
      const off = p[0] - cfg.target[0];
      const head =
        Math.abs(off) <= cfg.tolerance
          ? '正解のラインとほぼ同じ位置です'
          : `正解のラインから${fmt(Math.abs(off))}m ${off > 0 ? 'ゴール寄り' : 'センター寄り'}です`;
      return `${head}（${tol}）`;
    }
  }
}

export function judgePlacement(cfg: Placement, p: Vec2): PlacementJudgement {
  const distance = placementDistance(cfg, p);
  const ok = distance <= cfg.tolerance;
  let note = '';
  if (!ok) {
    for (const z of cfg.zones) {
      const d = 'at' in z ? Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) : Math.abs(p[0] - z.lineX);
      if (d <= z.r) {
        note = z.text;
        break;
      }
    }
  }
  return { ok, distance, note, desc: describePlacement(cfg, p) };
}
