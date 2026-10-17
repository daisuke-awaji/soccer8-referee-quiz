# 問題の作り方

問題は **1問 = 1ファイル**（`content/questions/<ID>.yaml`）です。ファイルを足して `content/stages.yaml` のどれかのステージに ID を書き、`npm run content:check` が通れば、アプリに出ます（コードの変更は要りません）。

## 手順

1. [question-backlog.md](./question-backlog.md) から作る問題を選び、Issue を立てる（1問 = 1 Issue）
2. **一次資料で根拠を確かめる**（条文・ページ）。確かめられない問題は作らない
3. 似た問題の YAML をコピーして `content/questions/<ID>.yaml` を作る
4. `content/stages.yaml` のステージに ID を足す（ステージは約10問。多くなったら新しいステージを作る）
5. `npm run dev` で開き、`http://localhost:5173/#/q/<ID>` で確認する
6. `npm run content:check` と `npm run e2e` を通す（E2E は全問を自動で解くので、新しい問題も自動で確かめられる）
7. PR を出す。`review.status` は `draft` のまま。監修者の確認後に `approved` にする

## ファイルの形

```yaml
id: D-05                 # ファイル名と同じ。分野の英字（A〜K）＋2〜3桁
category: offside        # content/categories.yaml の ID
badges: []               # new2026 = 2026/27改正点 / provisional = 一部が監修前の暫定解答
review: {status: draft}  # draft → inReview → approved
title: 自分の陣地でパスを受けた
kind: 2d                 # 2d / 3d / text（図なし）
hint: どこでボールを受けたかに注目しましょう。   # 最初の質問で「ヒントを見る」から開ける
scene: ...               # 2D の動き（下の「2D のシーン」）
steps: ...               # 問い（1つ以上。上から順に出す）
explain:
  summary: 1〜2文の結論。{{用語}} と書くとタップで説明が出る（content/glossary.yaml）
  detail: くわしい解説
  overlays: []           # 解説リプレイで重ねるもの
refs:                    # 出典（必須）。src は content/sources.yaml の ID
  - {src: laws, article: 第11条 オフサイド}
```

### 2D のシーン

座標は **m 単位** です。`x = 0〜68`（ピッチの長辺。**赤チームは x=68 の青ゴールへ攻撃**）、`y = 0〜50`（短辺。y=0 がベンチ側）。

```yaml
scene:
  view: {x: 36, y: 0, w: 33, h: 50}   # 表示する範囲（省略するとピッチ全体）
  actors:                              # 登場人物
    - {id: R10, role: player, team: red, label: "10"}
    - {id: B1, role: goalkeeper, team: blue, label: "1"}
    - {id: ball, role: ball}
    - {id: REF, role: referee}         # 主審（「主」と表示）
    - {id: AR2, role: assistant}       # 副審（「副」）。fourth = 第4の審判員、assistantSingle = 補助審判
  timeline:                            # キーフレーム。キーフレームの間はまっすぐ動く
    - t: 0
      positions: {R10: [44, 24], ball: [44.9, 24], B1: [66, 25], REF: [41, 17], AR2: [55, 50.9]}
      events:
        - {type: caption, text: 赤チームが攻撃中}    # 字幕
    - t: 2.5
      positions: {R10: [50, 25], ball: [51, 25]}    # 書かなかった人は前の位置にとどまる
      events:
        - {type: whistle}                            # 笛（音と「ピッ！」）
        - {type: highlight, actor: R10, dur: 1.5}    # 強調
  pauseAt: 2.5     # 判定の瞬間。ここで止まって選択肢が出る（0 なら再生なしの図）
  endAt: 4.0       # 解説リプレイの終わり（pauseAt より後の動きは、解説でだけ見せる）
```

ほかのイベント: `countdown`（5秒のカウントダウン: `{type: countdown, by: REF, from: 5, dur: 5}`）、`flag`（副審の旗）、`coin`（コイントス: `{type: coin, by: REF, result: heads}`。最初の1.2秒はコインが回り、そのあと `dur` 秒（省略時3秒）まで「表」または「裏」を出す。`tails` なら裏）。

### 問い（steps）

選択式:

```yaml
steps:
  - type: choice
    question: どう判定しますか？
    choices:
      - {id: goal, text: 得点を認める}
      - id: offside
        text: オフサイド
        feedback: 間違えたときに、この選択肢の下に出る「なぜ違うか」
    answer: goal
  - type: choice              # 手順は続けて足せる
    question: 懲戒は？
    ...
```

配置（ドラッグ）:

```yaml
  - type: placement
    question: 副審を正しい位置に動かしてください。
    placement:
      mode: line               # line = 登場人物をタッチライン沿いに動かす / free = ピッチ上の1点を置く
      actor: AR2
      fixedY: 51.4
      min: 34.5
      max: 68
      target: [57.5, 51.4]     # 正解
      tolerance: 1.5           # 正解とする範囲（m）。監修者と決める
      describe: {kind: lineOffset}   # 解答後の説明（distanceFromGoalLine も使える）
      zones:                   # よくある間違いと、その説明
        - {lineX: 65.5, r: 2, text: そこは最後尾（GK）のラインです。}
```

### 解説の重ね表示（overlays）

| type | 例 |
|---|---|
| `offsideLine` | `{type: offsideLine, actor: B5, label: 後方から2人目}` |
| `distanceCircle` | `{type: distanceCircle, center: ball, radius: 7, label: 7m}`（`dashed` / `muted` も使える） |
| `sightLine` | `{type: sightLine, from: B1, to: ball, label: GKの視線}` |
| `zone` | `{type: zone, x1: 31, x2: 37, y1: -1.6, y2: 1.6, label: 交代ゾーン}` |
| `marker` / `ruler` | `{type: marker, at: [60, 25]}` / `{type: ruler, from: [68, 15], to: [60, 15], label: 8m}` |

### 図のない問題（kind: text）

規則の数字や手順を問う問題は、図を作らずに書けます。`scene` は書きません。

```yaml
kind: text
steps:
  - type: choice
    question: 3人制審判では、第4の審判員を必ず置く。
    choices:
      - {id: o, text: 正しい, feedback: 3人制審判では、第4の審判員は任意です。}
      - {id: x, text: 誤り}
    answer: x
explain:
  summary: ...
  overlays: []        # 図がないので、重ね表示は使えない
```

○×問題は、選択肢を「正しい」「誤り」の2つにした選択式で書きます。`question` には判定してほしい文だけを書きます。選択肢で○×問題だと分かるので、「正しい？ 誤り？」のような前置きやかぎかっこは付けません。選択肢は書いた順に表示されるので、正解の位置が偏らないようにします。

### 3D

3D のシーンは動きをコードで作ります（`src/scene3d/scenes/`）。YAML では `scene3d.id` で使うシーンを選び、止める時刻と字幕を書きます。

## 検査されること（`npm run content:check`）

- スキーマ（項目名・型）に合っている。知らない項目があればエラー
- ファイル名と ID が同じ。ID が重複していない
- 正解の選択肢がある。選択肢の ID が重複していない
- キーフレームの時刻が順に並んでいる。登場人物がすべて定義され、一度は位置が出てくる
- `pauseAt` / `endAt` が動きの長さの中にある
- 解説の重ね表示・イベントが参照する登場人物がいる
- 出典が `sources.yaml` に、用語が `glossary.yaml` にある
- どの問題も、`stages.yaml` のちょうど1つのステージに入っている。ステージにない問題 ID を書いていない
