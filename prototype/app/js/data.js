/* 8人制 審判クイズ 試作版 — 問題データ
 * 座標系: x=0〜68m（ピッチ長辺。赤チームは x=68 側＝画面上の青ゴールへ攻撃）
 *         y=0〜50m（ピッチ短辺。y=0 がベンチ側＝画面左）
 * 時間は秒。timeline は actor ごとに線形補間。
 */
(function () {
  'use strict';

  const SRC = {
    eight: { label: 'JFA 8人制サッカー競技規則', url: 'https://www.jfa.jp/documents/pdf/eight/rules.pdf' },
    laws2627: { label: 'JFA 2026/27 競技規則 変更の概要と詳細', url: 'https://www.jfa.jp/documents/pdf/soccer/law_soccer_260528_01.pdf' },
    apply2627: { label: 'JFA 2026/27 競技規則の適用開始日', url: 'https://www.jfa.jp/documents/pdf/soccer/law_soccer_260528_02.pdf' },
    laws: { label: 'JFA サッカー競技規則', url: 'https://www.jfa.jp/laws/soccer/2025_26' }
  };

  const CATEGORIES = {
    basics: '8人制の基本',
    substitution: '交代',
    restart: '再開方法',
    offside: 'オフサイド',
    positioning: 'ポジショニング',
    officials: '審判団の役割',
    foul3d: 'ファウル判定（3D）'
  };

  // 用語集（解説文中の {{用語}} をタップすると表示）
  const GLOSSARY = {
    'インプレー': 'ボールが試合中で、プレーが続いている状態。',
    'アウトオブプレー': 'ボールがラインの外に出た、または主審が笛でプレーを止めた状態。',
    '直接フリーキック': 'キックしたボールが直接ゴールに入れば得点になるフリーキック。相手を蹴る・つまずかせるなどの反則で与えられる。',
    '間接フリーキック': 'ゴールに入る前に、ほかの競技者が触れなければ得点にならないフリーキック。主審は片手を上に上げて合図する。',
    '交代ゾーン': '8人制で交代のときに出入りする場所。ベンチ側のタッチラインで、ハーフウェーラインを挟んで3mずつ、計6m。',
    '後方から2人目の守備側競技者': 'ゴールラインに近い順に数えて2人目の守備側の競技者。GKも数に入る。多くの場合、GKの次に後ろにいるDF。',
    'オフサイドポジション': '相手陣内で、ボールと後方から2人目の守備側競技者の両方より、相手ゴールラインに近い位置。いるだけでは反則ではない。',
    '不用意': '相手に対する配慮や注意を欠いたプレー。ファウルだが、懲戒（カード）は不要。',
    '無謀': '相手にとって危険になることや、その結果をかえりみないプレー。警告（イエローカード）。',
    '著しく不正なプレー': 'ボールを争うときに、過剰な力や残忍な方法で相手の安全を脅かすタックルなど。退場（レッドカード）。',
    'ドロップボール': '主審がボールを落としてプレーを再開する方法。ボールがグラウンドに触れたらインプレーになる。',
    'アディショナルタイム': '交代や負傷などで空費された時間を、前後半の最後に追加する時間。',
    'クイックリスタート': '相手が離れるのを待たずに、素早くフリーキックなどを行うこと。',
    '補助審判': '1人制審判のときに必ず置かれる役。主審が続けられないときの代行、ボール交換、ベンチの管理、主審への援助を行う。',
    '第4の審判員': '3人制審判で任意に置かれる審判員。交代の手続き、用具の点検、アディショナルタイムの表示などで主審を援助する。'
  };

  const QUESTIONS = [
    /* ---------------------------------------------------------- A-01 */
    {
      id: 'A-01', category: 'basics', badges: [], levels: ['beginner', 'grade4'],
      title: 'ペナルティーマークはどこ？',
      kind: '2d',
      scene: {
        view: { x: 47, y: 0, w: 22, h: 50 }, pad: 1.2,
        pitch: { hidePenaltyMark: true, hidePenaltyArc: true },
        actors: [{ id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' }],
        timeline: [{ t: 0, positions: { B1: [67.3, 25] } }],
        pauseAt: 0
      },
      hint: '11人制（11m）より短く、ゴールエリア（4m）より遠い位置です。',
      steps: [{
        type: 'placement',
        question: '8人制のペナルティーマークは、どこにありますか？ ピッチをタップして置いてください。',
        placement: {
          mode: 'free', marker: 'PKマーク',
          target: [60, 25], tolerance: 1.0,
          describe: function (p) { return 'あなたの位置：ゴールラインから約' + (68 - p[0]).toFixed(1) + 'm（正解は8m。±1m以内を正解としています）'; },
          zones: [
            { at: [57, 25], r: 0.9, text: 'そこは11人制の距離（11m）です。8人制はピッチが小さいので短くなります。' },
            { lineX: 56, r: 0.6, text: 'そこはペナルティーエリアのライン（12m）です。ペナルティーマークはその内側です。' },
            { lineX: 64, r: 0.8, text: 'そこはゴールエリアのライン（4m）です。もっと遠くです。' }
          ]
        }
      }],
      explain: {
        summary: '8人制のペナルティーマークは、ゴールラインの中央から8mです。',
        detail: '8人制はピッチが約半分（68m×50m推奨）なので、主な距離も11人制より短くなっています。ペナルティーエリアはゴールポストの内側から12m、ゴールエリアは4m、ペナルティーアークとセンターサークルの半径は7mです。',
        overlays: [
          { type: 'marker', at: [60, 25], label: '8m' },
          { type: 'ruler', from: [68, 15], to: [60, 15], label: '8m' }
        ]
      },
      refs: [{ src: 'eight', article: '第1条 競技のフィールド' }]
    },

    /* ---------------------------------------------------------- A-02 */
    {
      id: 'A-02', category: 'basics', badges: [], levels: ['beginner', 'grade4'],
      title: 'フリーキックの壁の距離',
      kind: '2d',
      scene: {
        view: { x: 36, y: 0, w: 33, h: 50 },
        actors: [
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'B6', role: 'player', team: 'blue', label: '6' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'B7', role: 'player', team: 'blue', label: '7' },
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { R10: [42, 27], ball: [42.9, 27], R9: [54, 16], R7: [53, 38], B6: [51, 21], B4: [56, 22], B5: [56, 30], B7: [52, 33], B1: [66.5, 25], REF: [39, 19], AR2: [56, 50.9] },
            events: [{ type: 'caption', text: '赤10番がドリブルで攻め上がる' }] },
          { t: 1.2, positions: { R10: [47.6, 25.6], ball: [48.5, 25.3], B6: [48.3, 24.4] } },
          { t: 1.3, positions: { R10: [47.9, 25.5] },
            events: [{ type: 'whistle' }, { type: 'caption', text: '青6番のファウル。赤チームの直接フリーキック' }] },
          { t: 1.9, positions: { ball: [48.5, 25], R10: [47.2, 25.3], REF: [42, 20] } },
          { t: 2.8, positions: { B4: [53.5, 22.5], B5: [53.5, 25], B7: [53.5, 27.5], B6: [50, 19], REF: [44, 21] },
            events: [{ type: 'caption', text: '青チームは、ボールから約5mのところに壁を作った' }] },
          { t: 3.3, positions: {} },
          // ↓ 解説リプレイでのみ再生
          { t: 4.1, positions: { REF: [51.5, 22] }, events: [{ type: 'caption', text: '主審が壁を7mまで下げさせる' }] },
          { t: 5.1, positions: { B4: [56.2, 22.5], B5: [56.2, 25], B7: [56.2, 27.5], REF: [54.6, 20.6] } },
          { t: 5.7, positions: { REF: [46, 20] } },
          { t: 6.3, positions: {}, events: [{ type: 'whistle' }, { type: 'caption', text: '主審の笛の合図で再開' }] },
          { t: 6.9, positions: {} }
        ],
        pauseAt: 3.3, endAt: 6.9
      },
      hint: '8人制のフリーキック・コーナーキックの距離は、11人制とは違います。',
      steps: [{
        type: 'choice',
        question: '壁はボールから約5m。主審はどうしますか？',
        choices: [
          { id: 'ok5', text: 'そのままでよい（8人制は5m）', feedback: '8人制でも5mではありません。フリーキックのとき、相手競技者はボールから7m以上離れなければなりません。' },
          { id: 'm7', text: '7mまで下げさせる' },
          { id: 'm915', text: '9.15mまで下げさせる', feedback: '9.15mは11人制の距離です。8人制のフリーキックとコーナーキックは7mです。' }
        ],
        answer: 'm7'
      }],
      explain: {
        summary: '8人制のフリーキックでは、相手競技者はボールから7m以上離れます（コーナーキックも7m）。',
        detail: '攻撃側が{{クイックリスタート}}を選んだ場合は、相手が7m離れていなくても蹴ることができます。主審が距離をとらせて再開を管理したときは、笛の合図で再開します。',
        overlays: [
          { type: 'distanceCircle', center: 'ball', radius: 7, label: '7m（8人制）' },
          { type: 'distanceCircle', center: 'ball', radius: 9.15, label: '9.15m（11人制）', dashed: true, muted: true }
        ]
      },
      refs: [{ src: 'eight', article: '第13条 フリーキック' }]
    },

    /* ---------------------------------------------------------- B-01 */
    {
      id: 'B-01', category: 'substitution', badges: [], levels: ['beginner', 'grade4'],
      title: 'インプレー中の交代',
      kind: '2d',
      scene: {
        view: { x: 24, y: -8, w: 24, h: 58 }, pad: 0.6,
        pitch: { showBench: true },
        actors: [
          { id: 'B9', role: 'player', team: 'blue', label: '9' },
          { id: 'B10', role: 'player', team: 'blue', label: '10' },
          { id: 'R4', role: 'player', team: 'red', label: '4' },
          { id: 'R5', role: 'player', team: 'red', label: '5' },
          { id: 'R3', role: 'player', team: 'red', label: '3' },
          { id: 'R8', role: 'player', team: 'red', label: '8' },
          { id: 'S12', role: 'substitute', team: 'red', label: '12' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR1', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { B9: [45, 36], ball: [44.2, 35.6], B10: [41, 44], R4: [31, 31], R5: [30, 21], R3: [33, 41], R8: [37.5, 7], S12: [33, -3], REF: [41, 25], AR1: [29, -0.9] },
            events: [{ type: 'caption', text: 'インプレー中。青チームが攻めている' }] },
          { t: 1.0, positions: {}, events: [{ type: 'caption', text: '赤8番がベンチへ下がり、赤12番が入ろうとしている' }, { type: 'highlight', actor: 'R8', dur: 2.4 }] },
          { t: 2.0, positions: { R8: [34.4, 0.4] } },
          { t: 2.5, positions: { R8: [34.2, -3.2], S12: [33.4, 0.5] },
            events: [{ type: 'caption', text: '交代ゾーンから出て、交代ゾーンから入った' }, { type: 'highlight', actor: 'S12', dur: 1.4 }] },
          { t: 3.7, positions: { B9: [34, 30], ball: [33.2, 29.6], B10: [32, 40], R4: [28.5, 30], R5: [27.5, 22], R3: [30, 38], S12: [37, 8], REF: [37, 23], AR1: [27.5, -0.9] } },
          { t: 4.7, positions: { B9: [30, 28], ball: [29.2, 27.6], S12: [38, 12], REF: [34, 22] },
            events: [{ type: 'caption', text: 'プレーはそのまま続く' }] }
        ],
        pauseAt: 3.7, endAt: 4.7
      },
      hint: '8人制の交代は「自由な交代」と呼ばれます。',
      steps: [{
        type: 'choice',
        question: 'ボールがインプレー中に、交代が行われました。主審はどうしますか？',
        choices: [
          { id: 'stop', text: 'プレーを止めて、交代をやり直させる', feedback: '8人制では、インプレー中でも交代できます。プレーを止める必要はありません。' },
          { id: 'go', text: 'そのままプレーを続けさせる' },
          { id: 'yc', text: '交代要員に警告（イエローカード）を示す', feedback: '交代ゾーンから正しく出入りしているので、反則ではありません。' }
        ],
        answer: 'go'
      }],
      explain: {
        summary: '8人制のフィールドプレーヤーの交代は、{{インプレー}}中でも{{アウトオブプレー}}中でもでき、主審の承認もいりません。',
        detail: '退く競技者も入る競技者も、{{交代ゾーン}}から出入りします。GKの交代だけは別で、アウトオブプレーのときに主審に通知し、承認を得て行います。',
        overlays: [{ type: 'zone', x1: 31, x2: 37, y1: -1.6, y2: 1.6, label: '交代ゾーン（6m）' }]
      },
      refs: [{ src: 'eight', article: '第3条 競技者（交代の手続き）' }]
    },

    /* ---------------------------------------------------------- D-01 */
    {
      id: 'D-01', category: 'offside', badges: [], levels: ['beginner', 'grade4'],
      title: 'プレーに関わらないオフサイドポジション',
      kind: '2d',
      scene: {
        view: { x: 36, y: 0, w: 33, h: 50 },
        actors: [
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { R10: [44, 24], R7: [60, 42], R9: [50, 14], B4: [54, 22], B5: [55, 32], B1: [66, 25], ball: [44.9, 24], REF: [41, 17], AR2: [55, 50.9] },
            events: [{ type: 'caption', text: '赤チームが青ゴールへ攻撃中' }] },
          { t: 1.2, positions: {}, events: [{ type: 'caption', text: '赤7番はオフサイドポジション。プレーに関わらず、歩いて戻っている' }, { type: 'highlight', actor: 'R7', dur: 1.8 }] },
          { t: 2.2, positions: { R10: [50, 25], R7: [57.5, 44], R9: [53, 15], B4: [54, 23], B5: [55, 30], B1: [65, 25], ball: [50.9, 25], REF: [45, 18] } },
          { t: 2.5, positions: { ball: [51.1, 25], R10: [50.4, 25] }, events: [{ type: 'caption', text: '赤10番がシュート' }] },
          { t: 3.3, positions: { ball: [68.4, 27], B1: [65.6, 26.2], R7: [57, 44], REF: [47, 19] }, events: [{ type: 'caption', text: 'ゴール！' }] },
          { t: 3.4, positions: {} },
          { t: 4.6, positions: { REF: [44, 23] }, events: [{ type: 'caption', text: '得点を認め、キックオフで再開' }] }
        ],
        pauseAt: 3.4, endAt: 4.6
      },
      hint: '「その位置にいること」と「プレーに関わること」を分けて考えましょう。',
      steps: [{
        type: 'choice',
        question: '赤10番のシュートが決まりました。オフサイドポジションには赤7番がいます。どう判定しますか？',
        choices: [
          { id: 'goal', text: '得点を認める（オフサイドの反則ではない）' },
          { id: 'offside', text: 'オフサイド。青チームの間接フリーキック', feedback: 'オフサイドポジションにいるだけでは反則になりません。プレーや相手に干渉した、またはその位置にいて利益を得たときに初めて罰せられます。' },
          { id: 'db', text: '得点を認めず、ドロップボールで再開', feedback: '反則も外的要因による妨害もないので、プレーを止める理由がありません。' }
        ],
        answer: 'goal'
      }],
      explain: {
        summary: '{{オフサイドポジション}}にいるだけでは反則ではありません。赤7番はボールにも相手にも関わっていないので、得点を認めます。',
        detail: '副審は、オフサイドポジションの競技者がプレーに関わったかを見極めてから旗を上げます。すぐに旗を上げず、少し待って判断するのが基本です。',
        overlays: [
          { type: 'offsideLine', actor: 'B5', label: '後方から2人目（青5番）' },
          { type: 'sightLine', from: 'B1', to: 'ball', label: 'GKの視線は遮られていない' }
        ]
      },
      refs: [{ src: 'laws', article: '第11条 オフサイド' }]
    },

    /* ---------------------------------------------------------- D-02 */
    {
      id: 'D-02', category: 'offside', badges: [], levels: ['beginner', 'grade4'],
      title: 'スローインとオフサイド',
      kind: '2d',
      scene: {
        view: { x: 36, y: 0, w: 33, h: 52 },
        actors: [
          { id: 'R3', role: 'player', team: 'red', label: '3' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'B6', role: 'player', team: 'blue', label: '6' },
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { R3: [58, 51.1], ball: [58, 50.6], R9: [62.6, 43], R10: [52, 30], R7: [56, 20], B4: [60, 40], B5: [59, 30], B6: [57, 21], B1: [66.5, 25], REF: [50, 33], AR2: [60, 51.6] },
            events: [{ type: 'caption', text: '赤チームのスローイン' }] },
          { t: 0.8, positions: { ball: [58, 50.3] }, events: [{ type: 'caption', text: '赤3番がスローイン' }] },
          { t: 1.7, positions: { ball: [62.5, 43.6], R9: [62.9, 43.2], B4: [60.8, 41] }, events: [{ type: 'caption', text: 'オフサイドポジションの赤9番が、直接ボールを受けた' }, { type: 'highlight', actor: 'R9', dur: 1.2 }] },
          { t: 2.0, positions: { R9: [63.3, 42], ball: [63.6, 41.4] } },
          { t: 2.8, positions: { R9: [64, 36], ball: [64.5, 35.4], B4: [62, 38], B1: [66.6, 27] } },
          { t: 3.5, positions: { ball: [68.4, 26.5], B1: [66.9, 27.5] }, events: [{ type: 'caption', text: 'そのままシュートして得点' }] },
          { t: 4.0, positions: {} }
        ],
        pauseAt: 2.0, endAt: 4.0
      },
      hint: 'どこから受けたボールか、に注目しましょう。',
      steps: [{
        type: 'choice',
        question: '赤9番はオフサイドポジションで、スローインのボールを直接受けました。副審は旗を上げますか？',
        choices: [
          { id: 'flag', text: '旗を上げる（オフサイドの反則）', feedback: 'スローインから直接ボールを受けた場合は、オフサイドの反則になりません。' },
          { id: 'noflag', text: '上げない（反則ではない）' },
          { id: 'retake', text: 'スローインをやり直させる', feedback: 'スローインは正しく行われています。やり直す理由はありません。' }
        ],
        answer: 'noflag'
      }],
      explain: {
        summary: 'スローイン、ゴールキック、コーナーキックから直接ボールを受けた場合は、オフサイドの反則になりません。',
        detail: 'フリーキックやドロップボールからは、オフサイドの反則になり得ます。再開方法によって違うので、セットで覚えておきましょう。',
        overlays: [{ type: 'offsideLine', actor: 'B4', label: '後方から2人目（青4番）' }]
      },
      refs: [{ src: 'laws', article: '第11条 オフサイド' }]
    },

    /* ---------------------------------------------------------- E-01 */
    {
      id: 'E-01', category: 'positioning', badges: [], levels: ['beginner', 'grade4'],
      title: '副審はどこに立つ？',
      kind: '2d',
      scene: {
        view: { x: 34, y: 0, w: 35, h: 52 },
        actors: [
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'B6', role: 'player', team: 'blue', label: '6' },
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { R10: [40, 30], ball: [40.9, 30], R9: [52, 17], R7: [50, 41], B4: [55, 21], B5: [53, 33], B6: [47, 27], B1: [66, 25], REF: [35, 22], AR2: [45, 51.4] },
            events: [{ type: 'caption', text: '赤10番がドリブルで攻め上がる' }] },
          { t: 2.0, positions: { R10: [48, 28], ball: [48.9, 28], R9: [56, 18], R7: [54, 40], B4: [57.5, 21], B5: [55, 32], B6: [50, 27], B1: [65.5, 25.5], REF: [42, 21] },
            events: [{ type: 'caption', text: '副審（右）を正しい位置へ動かそう' }] }
        ],
        pauseAt: 2.0
      },
      hint: 'GKも「守備側競技者」に数えます。',
      steps: [{
        type: 'placement',
        question: '右側の副審を、タッチライン沿いにドラッグ（またはタップ）して、正しい位置に動かしてください。',
        placement: {
          mode: 'line', actor: 'AR2', fixedY: 51.4, min: 34.5, max: 68,
          target: [57.5, 51.4], tolerance: 1.5,
          describe: function (p) { const d = p[0] - 57.5; return (Math.abs(d) <= 1.5 ? '正解のラインとほぼ同じ位置です' : '正解のラインから' + Math.abs(d).toFixed(1) + 'm ' + (d > 0 ? 'ゴール寄り' : 'センター寄り') + 'です') + '（±1.5m以内を正解としています）'; },
          zones: [
            { lineX: 65.5, r: 2.0, text: 'そこは最後尾（GK）のラインです。基準はGKを含めて「後方から2人目」の守備側競技者です。' },
            { lineX: 55, r: 1.0, text: 'そこは青5番のラインで、後方から3人目です。' },
            { lineX: 48.9, r: 2.0, text: 'そこはボールのラインです。ボールより前に守備側競技者がいるときは、後方から2人目の守備側競技者に合わせます。' }
          ]
        }
      }],
      explain: {
        summary: '副審は、{{後方から2人目の守備側競技者}}と同じライン（ボールのほうがゴールラインに近ければボールのライン）に立ちます。',
        detail: 'このラインにいることで、オフサイドラインを真横から見られます。ここでは GK（青1番）が最後尾、青4番が後方から2人目です。',
        overlays: [{ type: 'offsideLine', actor: 'B4', label: '後方から2人目（青4番）' }]
      },
      refs: [{ src: 'laws', article: '第6条 その他の審判員／第11条 オフサイド' }]
    },

    /* ---------------------------------------------------------- C-01 */
    {
      id: 'C-01', category: 'restart', badges: ['new2026'], levels: ['beginner', 'grade4'],
      title: 'スローインを遅らせる',
      kind: '2d',
      scene: {
        view: { x: 36, y: 0, w: 33, h: 52 },
        actors: [
          { id: 'R3', role: 'player', team: 'red', label: '3' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'B2', role: 'player', team: 'blue', label: '2' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { R3: [50, 51.1], ball: [50, 50.6], R9: [55, 40], R7: [52, 30], R10: [46, 36], B2: [49, 44], B4: [56, 38], B5: [55, 28], B1: [66.5, 25], REF: [44, 36], AR2: [56, 51.7] },
            events: [{ type: 'caption', text: '赤チームが1点リード。試合終了まで、あと少し' }] },
          { t: 1.2, positions: {}, events: [{ type: 'caption', text: '赤3番は、なかなかスローインをしない' }, { type: 'highlight', actor: 'R3', dur: 1.4 }] },
          { t: 2.4, positions: { R3: [48, 51.1], ball: [48, 50.6] } },
          { t: 2.6, positions: {}, events: [{ type: 'whistle' }, { type: 'caption', text: '主審が笛を吹き、5秒のカウントダウンを始めた' }] },
          { t: 2.8, positions: {}, events: [{ type: 'countdown', by: 'REF', from: 5, dur: 5 }] },
          { t: 5.2, positions: { R3: [48.6, 51.1], ball: [48.6, 50.6] } },
          { t: 7.6, positions: { R3: [48.1, 51.1], ball: [48.1, 50.6] } },
          { t: 8.0, positions: {} },
          { t: 8.4, positions: {}, events: [{ type: 'whistle' }, { type: 'caption', text: '5秒経過。青チームのスローインで再開' }] },
          { t: 9.2, positions: { R3: [50, 47], B2: [48.1, 51.1], ball: [48.1, 50.6] } },
          { t: 9.6, positions: {} },
          { t: 10.3, positions: { ball: [52, 45] } },
          { t: 10.6, positions: {} }
        ],
        pauseAt: 8.0, endAt: 10.6
      },
      hint: '2026/27版で新しく加わったルールです。',
      steps: [{
        type: 'choice',
        question: '主審の5秒のカウントダウンが終わっても、赤3番はスローインをしません。どうなりますか？',
        choices: [
          { id: 'blue', text: '相手チーム（青）のスローインになる' },
          { id: 'ycred', text: '赤3番に警告し、赤チームのスローインでやり直す', feedback: '2026/27版では、まず相手チームのスローインになります。警告するのは、その後も過度に再開を遅らせた場合だけです。' },
          { id: 'ifk', text: '青チームの間接フリーキックになる', feedback: 'スローインを遅らせた場合の再開は、相手チームのスローインです。' },
          { id: 'wait', text: '何もせず、スローインを待つ', feedback: 'カウントダウンが終わったら、相手チームのスローインにします。待ち続ける必要はありません。' }
        ],
        answer: 'blue'
      }],
      explain: {
        summary: 'スローインを不当に遅らせているとき、主審は笛を吹き、手を上げて5秒をカウントダウンします。5秒を過ぎたら相手チームのスローインです。',
        detail: '警告するのは、相手チームのスローインになった後も過度に再開を遅らせた場合だけです。ゴールキックにも同じようなカウントダウンがあります（次の問題）。',
        overlays: []
      },
      refs: [{ src: 'laws2627', article: '第15条 スローイン（2026/27改正）' }, { src: 'apply2627', article: '適用開始日' }]
    },

    /* ---------------------------------------------------------- C-02 */
    {
      id: 'C-02', category: 'restart', badges: ['new2026'], levels: ['beginner', 'grade4'],
      title: 'ゴールキックを遅らせる',
      kind: '2d',
      scene: {
        view: { x: 44, y: 0, w: 25, h: 52 },
        actors: [
          { id: 'B1', role: 'goalkeeper', team: 'blue', label: '1' },
          { id: 'B4', role: 'player', team: 'blue', label: '4' },
          { id: 'B5', role: 'player', team: 'blue', label: '5' },
          { id: 'R9', role: 'player', team: 'red', label: '9' },
          { id: 'R10', role: 'player', team: 'red', label: '10' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'ball', role: 'ball' },
          { id: 'REF', role: 'referee' },
          { id: 'AR2', role: 'assistant' }
        ],
        timeline: [
          { t: 0, positions: { B1: [66, 22], ball: [65, 20.5], B4: [60, 13], B5: [61, 35], R9: [55, 27], R10: [51, 19], R7: [57, 39], REF: [52, 30], AR2: [64, 51.4] },
            events: [{ type: 'caption', text: '青チームが1点リード。青チームのゴールキック' }] },
          { t: 1.2, positions: { B1: [66.6, 24] }, events: [{ type: 'caption', text: 'GKはボールを置いたまま、なかなか蹴らない' }, { type: 'highlight', actor: 'B1', dur: 1.6 }] },
          { t: 2.2, positions: { B1: [65.8, 22.3] } },
          { t: 2.4, positions: {}, events: [{ type: 'whistle' }, { type: 'caption', text: '主審が笛を吹き、5秒のカウントダウンを始めた' }] },
          { t: 2.6, positions: {}, events: [{ type: 'countdown', by: 'REF', from: 5, dur: 5 }] },
          { t: 5.0, positions: { B1: [66.3, 23] } },
          { t: 7.4, positions: { B1: [65.9, 22.2] } },
          { t: 7.8, positions: {} },
          { t: 8.2, positions: {}, events: [{ type: 'whistle' }, { type: 'caption', text: '5秒経過。赤チームのコーナーキックで再開' }] },
          { t: 9.6, positions: { ball: [67.7, 49.7], R7: [67.2, 50.8], REF: [58, 36], R9: [62, 30], R10: [60, 22] } },
          { t: 10.0, positions: {} }
        ],
        pauseAt: 7.8, endAt: 10.0
      },
      hint: 'スローインの遅延と似たルールですが、再開方法が違います。',
      steps: [{
        type: 'choice',
        question: '5秒のカウントダウンが終わっても、GKはゴールキックを蹴りません。再開方法は？',
        choices: [
          { id: 'ck', text: '相手チーム（赤）のコーナーキック' },
          { id: 'ifk', text: '赤チームの間接フリーキック', feedback: '2026/27版では、ゴールキックを遅らせた場合は相手チームのコーナーキックです。' },
          { id: 'ycretake', text: 'GKに警告し、ゴールキックをやり直す', feedback: 'まず相手チームのコーナーキックになります。警告は、その後も過度に遅らせた場合だけです。' },
          { id: 'ckyc', text: '赤チームのコーナーキック＋GKに警告', feedback: '再開方法は正しいですが、カウントダウンを過ぎただけでは警告しません。警告は、コーナーキックになった後も過度に遅らせた場合です。' }
        ],
        answer: 'ck'
      }],
      explain: {
        summary: 'ゴールキックを不当に遅らせると、5秒のカウントダウンの後、相手チームのコーナーキックになります。',
        detail: 'GKが手や腕でボールを8秒を超えてコントロールした場合も、相手チームのコーナーキックです（主審は残り5秒を合図でカウントします）。「時間かせぎ → 相手のチャンス」と覚えると整理しやすいです。',
        overlays: []
      },
      refs: [{ src: 'laws2627', article: '第16条 ゴールキック／第17条 コーナーキック（2026/27改正）' }, { src: 'apply2627', article: '適用開始日' }]
    },

    /* ---------------------------------------------------------- F-01 */
    {
      id: 'F-01', category: 'officials', badges: [], levels: ['beginner', 'grade4'],
      title: 'ベンチの間に座っている人',
      kind: '2d',
      scene: {
        view: { x: 23, y: -9, w: 22, h: 20 }, pad: 0.4,
        pitch: { showBench: true, showFourthTable: true },
        actors: [
          { id: 'FOURTH', role: 'fourth' },
          { id: 'S12', role: 'substitute', team: 'red', label: '12' },
          { id: 'S14', role: 'substitute', team: 'blue', label: '14' },
          { id: 'R7', role: 'player', team: 'red', label: '7' },
          { id: 'B6', role: 'player', team: 'blue', label: '6' },
          { id: 'AR1', role: 'assistant' }
        ],
        timeline: [{ t: 0, positions: { FOURTH: [34, -4.6], S12: [29.5, -4.4], S14: [38.5, -4.4], R7: [37, 6], B6: [30, 8.5], AR1: [27, -0.9] } }],
        pauseAt: 0,
        static: true,
        spotlight: 'FOURTH'
      },
      hint: '最後の判断を下すのは誰でしょう？',
      steps: [
        {
          type: 'choice',
          question: '3人制審判の試合で、ベンチの間に座っている「第4の審判員」。その任務として正しくないものはどれ？',
          choices: [
            { id: 'sub', text: '交代の手続きを管理する', note: '○ 第4の審判員の任務', feedback: 'これは第4の審判員の任務です。' },
            { id: 'equip', text: '競技者と交代要員の用具を点検する', note: '○ 第4の審判員の任務', feedback: 'これは第4の審判員の任務です。' },
            { id: 'time', text: 'アディショナルタイムを表示する', note: '○ 第4の審判員の任務', feedback: 'これは第4の審判員の任務です。主審が決めた最小限の時間を表示します。' },
            { id: 'whistle', text: '自分の判断で笛を吹き、プレーを止める', note: '× 任務ではない（判定を下すのは主審）' }
          ],
          answer: 'whistle'
        },
        {
          type: 'choice', levels: ['grade4'],
          question: '（4級）1人制審判の試合で、ベンチ横の補助審判。主審が警告する選手を間違えました。補助審判はどうしますか？',
          choices: [
            { id: 'tell', text: 'すぐに主審に知らせて援助する' },
            { id: 'card', text: '自分で正しい選手にカードを示す', feedback: '補助審判はカードを示しません。判定を下すのは主審です。' },
            { id: 'after', text: '試合後に報告するだけにする', feedback: '人違いは、試合中に主審に知らせて援助する任務です。' }
          ],
          answer: 'tell'
        }
      ],
      explain: {
        summary: '{{第4の審判員}}は主審を援助する役で、最終決定は常に主審が下します。',
        detail: '第4の審判員の主な任務：交代の手続きの管理／競技者と交代要員の用具の点検／主審の合図を受けた後の競技者の再入場／ボール交換の管理／アディショナルタイムの表示／テクニカルエリアで責任ある行動をとらなかった人について主審に伝える。8人制の3人制審判では、第4の審判員は任意です。1人制審判では{{補助審判}}が必須で、人違いの警告、2枚目の警告なのに退場が命じられていない、主審が見ていない乱暴な行為などのときに主審を援助します。',
        overlays: []
      },
      refs: [{ src: 'laws', article: '第6条 その他の審判員' }, { src: 'eight', article: '主審／その他の審判員・補助審判の役割' }]
    },

    /* ---------------------------------------------------------- H-01 */
    {
      id: 'H-01', category: 'foul3d', badges: ['provisional'], levels: ['beginner', 'grade4'],
      title: '横からのスライディングタックル',
      kind: '3d',
      scene3d: {
        pauseAt: 2.7, endAt: 3.6, contactAt: 1.6,
        captions: [
          { t: 0, text: '赤10番がドリブルで前へ。ペナルティーエリアの外' },
          { t: 0.9, text: '青4番が横からスライディング' },
          { t: 1.75, text: '赤10番が倒れた' }
        ]
      },
      hint: '足が当たった瞬間、ボールはどこにありましたか？',
      steps: [
        {
          type: 'choice',
          question: '主審の位置から見たタックルです。ファウルですか？',
          choices: [
            { id: 'nofoul', text: 'ノーファウル（ボールに向かった正当なタックル）', feedback: '主審の位置からは、足とボールが重なって「ボールに行った」ように見えます。でも、足が当たったとき、ボールはすでに2m以上前にありました。' },
            { id: 'foul', text: 'ファウル' }
          ],
          answer: 'foul'
        },
        {
          type: 'choice',
          question: '再開方法は？',
          choices: [
            { id: 'dfk', text: '赤チームの直接フリーキック' },
            { id: 'ifk', text: '赤チームの間接フリーキック', feedback: '相手をつまずかせる・蹴るなど、相手競技者との接触を伴う反則は{{直接フリーキック}}です。' },
            { id: 'pk', text: 'ペナルティーキック', feedback: '反則があった位置は、ペナルティーエリアの外です。' },
            { id: 'db', text: 'ドロップボール', feedback: '反則があったので、反則をされた側のフリーキックで再開します。' }
          ],
          answer: 'dfk'
        },
        {
          type: 'choice', levels: ['grade4'],
          question: '（4級）懲戒はどうしますか？',
          choices: [
            { id: 'none', text: 'なし（不用意なファウル）', feedback: 'ボールがなくなった後に、足裏を向けて勢いよく滑り込んでいます。相手への危険をかえりみない「無謀」と考えるのが妥当です（暫定）。' },
            { id: 'yc', text: '警告（無謀なファウル）' },
            { id: 'rc', text: '退場（著しく不正なプレー）', feedback: '足は低く、片足で、スピードも極端ではありません。「過剰な力」とまではいえないと考えます（暫定）。' }
          ],
          answer: 'yc'
        }
      ],
      explain: {
        summary: 'ボールがすでに離れた後の、遅れたタックルです。相手の足に当たっているのでファウル、ペナルティーエリアの外なので直接フリーキックです。',
        detail: '見る角度で印象が変わることを、視点を切り替えて確かめてください。主審の位置（後方）からは、足・ボール・相手が一直線に重なり、ボールに行ったように見えます。副審の位置からは、足裏が相手のすねに向いているのが見えます。真横からは、接触したときボールが2m以上前にあったことが分かります。だから主審は、副審とでプレーを挟む位置をとって死角をなくします。懲戒の判断（{{不用意}}／{{無謀}}／{{著しく不正なプレー}}）は、監修前の暫定解答です。',
        overlays: []
      },
      refs: [{ src: 'laws', article: '第12条 ファウルと不正行為' }]
    }
  ];

  window.QUIZ_DATA = { SRC: SRC, CATEGORIES: CATEGORIES, GLOSSARY: GLOSSARY, QUESTIONS: QUESTIONS, RULE_VERSION: '2026/27' };
})();
