/**
 * URL のハッシュで開く画面。ハッシュを使うので、GitHub Pages や CloudFront で書き換えの設定が要らない。
 *   #/                      ホーム
 *   #/q/A-01?lv=grade4      問題を直接開く（監修・確認用。成績には記録しない）
 *   #q=A-01&lv=grade4       試作版 v0.1 と同じ形式（互換のため）
 */
import type { Level } from '../content/schema';

export type DirectLink = { id: string; level: Level | null };

export function parseDirectLink(hash: string): DirectLink | null {
  const m = hash.match(/^#\/q\/([A-J]-\d{2,3})(?:\?(.*))?$/) ?? hash.match(/^#q=([A-J]-\d{2,3})(?:&(.*))?$/);
  if (!m) return null;
  const lv = new URLSearchParams(m[2] ?? '').get('lv');
  return { id: m[1]!, level: lv === 'beginner' || lv === 'grade4' ? lv : null };
}

export const directLinkHash = (id: string, level: Level) => `#/q/${id}?lv=${level}`;

export function clearHash(): void {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
