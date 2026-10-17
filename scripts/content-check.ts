/**
 * 問題データの検査（CI で必須）。
 *   npm run content:check
 * スキーマ違反・参照切れ・時刻の順序などを一覧で表示し、1件でもあれば終了コード 1 で終わる。
 */
import { loadContent, formatIssues } from '../plugins/content';

const { bundle, issues } = loadContent();
const qs = bundle.questions;
const byStatus = qs.reduce<Record<string, number>>((m, q) => ((m[q.review.status] = (m[q.review.status] ?? 0) + 1), m), {});

console.log(`問題 ${qs.length} 問・ステージ ${bundle.stages.length}`);
console.log(`監修の状態: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
if (issues.length) {
  console.error(`\n✗ ${issues.length} 件の問題があります:\n${formatIssues(issues)}`);
  process.exit(1);
}
console.log('✓ 問題データに問題はありません');
