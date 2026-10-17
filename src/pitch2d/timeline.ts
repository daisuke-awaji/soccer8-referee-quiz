/** キーフレームから登場人物ごとの軌跡を作り、時刻 t の位置を求める（DOM に依存しない） */
import type { Keyframe, SceneEvent, Vec2 } from '../content/schema';

export const PITCH_LENGTH = 68;
export const PITCH_WIDTH = 50;

/** フィールド座標 (x: 長辺, y: 短辺) → SVG 座標。赤チームが画面の上へ攻撃するように回転する */
export const toScreen = (x: number, y: number): Vec2 => [y, PITCH_LENGTH - x];

export type Track = Array<[t: number, x: number, y: number]>;
export type TimedEvent = SceneEvent & { t: number };

export interface CompiledTimeline {
  tracks: Record<string, Track>;
  events: TimedEvent[];
  duration: number;
}

export function compileTimeline(timeline: Keyframe[]): CompiledTimeline {
  const tracks: Record<string, Track> = {};
  const events: TimedEvent[] = [];
  for (const kf of timeline) {
    for (const [id, p] of Object.entries(kf.positions)) (tracks[id] ??= []).push([kf.t, p[0], p[1]]);
    for (const ev of kf.events ?? []) events.push({ ...ev, t: kf.t });
  }
  for (const tr of Object.values(tracks)) tr.sort((a, b) => a[0] - b[0]);
  events.sort((a, b) => a.t - b.t);
  const last = timeline[timeline.length - 1];
  return { tracks, events, duration: last ? last.t : 0 };
}

/** 軌跡を線形補間する。軌跡がなければ null */
export function positionAt(track: Track | undefined, t: number): Vec2 | null {
  if (!track || track.length === 0) return null;
  const first = track[0]!;
  if (t <= first[0]) return [first[1], first[2]];
  for (let i = 1; i < track.length; i++) {
    const b = track[i]!;
    if (t <= b[0]) {
      const a = track[i - 1]!;
      const k = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  const z = track[track.length - 1]!;
  return [z[1], z[2]];
}

/** 時刻 t の時点で表示する字幕（最後に出てきたもの） */
export function captionAt(events: TimedEvent[], t: number): string {
  let c = '';
  for (const ev of events) if (ev.t <= t + 1e-6 && ev.type === 'caption') c = ev.text;
  return c;
}
