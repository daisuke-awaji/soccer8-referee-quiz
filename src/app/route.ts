/**
 * URL のハッシュで開く画面。ハッシュを使うので、GitHub Pages や CloudFront で書き換えの設定が要らない。
 *   #/                      ホーム
 *   #/q/A-01                問題を直接開く（監修・確認用。成績には記録しない）
 *   #q=A-01                 試作版 v0.1 と同じ形式（互換のため）
 * 以前のレベル指定（?lv=grade4 など）が付いていても、そのまま開ける。
 */
export type DirectLink = { id: string };

export function parseDirectLink(hash: string): DirectLink | null {
  const m = hash.match(/^#\/q\/([A-K]-\d{2,3})(?:\?.*)?$/) ?? hash.match(/^#q=([A-K]-\d{2,3})(?:&.*)?$/);
  return m ? { id: m[1]! } : null;
}

export function clearHash(): void {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
