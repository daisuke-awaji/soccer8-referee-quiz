# 8人制 審判トレーニング

8人制サッカー（U-12）の審判を担当する **保護者審判** と **4級審判員** が、スマホで「プレーを見て、判定の瞬間で止めて、答える」練習をするための Web アプリ。

**▶ 試験公開中: https://daisuke-awaji.github.io/soccer8-referee-quiz/**

> 問題と解説は監修前です。実際の判定は JFA の競技規則に従ってください。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/plan.md](./docs/plan.md) | 開発計画書（目的・技術構成・マイルストーン・テスト・リスク） |
| [docs/question-backlog.md](./docs/question-backlog.md) | 問題候補の一覧（96問。第1弾は67問） |
| [docs/authoring.md](./docs/authoring.md) | 問題の作り方（YAML の書き方と、自動で検査されること） |
| [prototype/](./prototype/) | 試作版 v0.1（1ファイル HTML 版。参照用） |

## 開発

Node.js 22 を使います。

```bash
npm ci
npm run dev            # 開発サーバー（http://localhost:5173/）
npm run check          # lint・型チェック・問題データの検査・単体テスト
npm run e2e            # E2E（Playwright。初回は npx playwright install chromium）
BASE_URL=https://daisuke-awaji.github.io/soccer8-referee-quiz/ npx playwright test --project=phone   # 公開済みのサイトを確かめる
npm run build          # dist/ に静的サイトを出力
```

問題を1問だけ開く（監修・確認用。成績には記録しない）: `/#/q/H-01`

### 構成

```
content/            問題データ（1問 = 1 YAML）・用語集・出典・分野
src/content/        スキーマ（Zod）と、ファイルをまたいだ検査
src/engine/         採点・出題・集計（画面に依存しない）
src/pitch2d/        2D ピッチ（SVG）の描画・アニメーション・配置問題
src/scene3d/        3D シーン（three.js。3D の問題を開いたときだけ読み込む）
src/screens/        ホーム・問題・結果の画面（React）
plugins/content.ts  ビルド時に content/ を読み込み、検査してアプリに渡す
tests/unit/         単体テスト（Vitest）
tests/e2e/          E2E（全問を自動で解く・画面の流れ・アクセシビリティ）
```

### 公開

`main` に入ると GitHub Actions が検査とビルドを行い、GitHub Pages に公開します（`.github/workflows/pages.yml`）。
ビルドは相対パスで出力するので、同じ成果物を S3 + CloudFront などにも置けます。

## 準拠する規則

- JFA「8人制サッカー競技規則」（8人制で修正されていない部分は「サッカー競技規則」が適用される）
- JFA「サッカー競技規則 2026/27」（地域の大会では適用開始日が異なる場合がある）

問題の正解は一次資料の条文に基づいて作り、規則の文章だけで決まらないものは監修者の確認を経て公開します。

