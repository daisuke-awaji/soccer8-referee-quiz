/**
 * 問題データのスキーマ（Zod）。
 *
 * 座標系（2D）: x = 0〜68m（ピッチ長辺。赤チームは x=68 側の青ゴールへ攻撃）
 *               y = 0〜50m（ピッチ短辺。y=0 がベンチ側タッチライン）
 * 時間は秒。timeline は登場人物ごとにキーフレーム間を線形補間する。
 *
 * このファイルはアプリ・ビルド（Vite プラグイン）・content:check・テストで共有する。
 */
import { z } from 'zod';

export const LEVELS = ['beginner', 'grade4'] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const CATEGORY_IDS = [
  'basics',
  'substitution',
  'restart',
  'offside',
  'positioning',
  'officials',
  'foul',
  'foul3d',
  'signals',
  'matchTime',
] as const;
export const Category = z.enum(CATEGORY_IDS);
export type Category = z.infer<typeof Category>;

/** 登録済みの3Dシーン（src/scene3d/scenes/ に実装がある ID） */
export const SCENE3D_IDS = ['slidingTackle'] as const;

const Vec2 = z.tuple([z.number(), z.number()]);
export type Vec2 = z.infer<typeof Vec2>;

const Actor = z.object({
  id: z.string().min(1),
  role: z.enum(['player', 'goalkeeper', 'ball', 'referee', 'assistant', 'fourth', 'assistantSingle', 'substitute']),
  team: z.enum(['red', 'blue']).optional(),
  label: z.string().optional(),
});
export type Actor = z.infer<typeof Actor>;

const SceneEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('caption'), text: z.string() }),
  z.object({ type: z.literal('whistle') }),
  z.object({ type: z.literal('highlight'), actor: z.string(), dur: z.number().positive().optional() }),
  z.object({
    type: z.literal('countdown'),
    by: z.string().default('REF'),
    from: z.number().int().positive().default(5),
    dur: z.number().positive(),
  }),
  z.object({ type: z.literal('flag'), by: z.string(), dur: z.number().positive().optional() }),
]);
export type SceneEvent = z.infer<typeof SceneEvent>;

const Keyframe = z.object({
  t: z.number().min(0),
  positions: z.record(z.string(), Vec2).default({}),
  events: z.array(SceneEvent).optional(),
});
export type Keyframe = z.infer<typeof Keyframe>;

const View = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });

const PitchOptions = z
  .object({
    hidePenaltyMark: z.boolean().optional(),
    hidePenaltyArc: z.boolean().optional(),
    showBench: z.boolean().optional(),
    showFourthTable: z.boolean().optional(),
  })
  .strict();

const Scene2D = z
  .object({
    view: View.optional(),
    pad: z.number().min(0).optional(),
    pitch: PitchOptions.optional(),
    actors: z.array(Actor),
    timeline: z.array(Keyframe).min(1),
    /** 判定の瞬間（ここで自動停止して選択肢を出す）。0 なら再生なし */
    pauseAt: z.number().min(0),
    /** 解説リプレイの終わり（省略時は pauseAt） */
    endAt: z.number().min(0).optional(),
    /** 動きのない図（再生ボタンを出さない） */
    static: z.boolean().optional(),
    /** 常に強調表示する登場人物 */
    spotlight: z.string().optional(),
  })
  .strict();
export type Scene2D = z.infer<typeof Scene2D>;

const Scene3D = z
  .object({
    id: z.enum(SCENE3D_IDS),
    pauseAt: z.number().positive(),
    endAt: z.number().positive(),
    contactAt: z.number().positive(),
    captions: z.array(z.object({ t: z.number().min(0), text: z.string() })).default([]),
  })
  .strict();
export type Scene3DDef = z.infer<typeof Scene3D>;

const Choice = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    /** 誤答時に、その選択肢の下に表示する「なぜ違うか」 */
    feedback: z.string().optional(),
    /** 解答後に、選択肢の中に小さく表示する注記 */
    note: z.string().optional(),
  })
  .strict();

const StepBase = { levels: z.array(Level).optional(), question: z.string().min(1) };

const ChoiceStep = z
  .object({ type: z.literal('choice'), ...StepBase, choices: z.array(Choice).min(2), answer: z.string() })
  .strict();

const Zone = z.union([
  z.object({ at: Vec2, r: z.number().positive(), text: z.string() }).strict(),
  z.object({ lineX: z.number(), r: z.number().positive(), text: z.string() }).strict(),
]);

/** 配置問題の解答後に出す説明文の種類（関数の代わりに宣言的に書く） */
const Describe = z.discriminatedUnion('kind', [
  /** 「ゴールラインから約 n m」 */
  z.object({ kind: z.literal('distanceFromGoalLine'), answerText: z.string() }).strict(),
  /** 「正解のラインから n m ゴール寄り／センター寄り」 */
  z.object({ kind: z.literal('lineOffset') }).strict(),
]);
export type Describe = z.infer<typeof Describe>;

const Placement = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('free'),
      marker: z.string().optional(),
      target: Vec2,
      tolerance: z.number().positive(),
      describe: Describe.optional(),
      zones: z.array(Zone).default([]),
    })
    .strict(),
  z
    .object({
      mode: z.literal('line'),
      actor: z.string(),
      fixedY: z.number(),
      min: z.number(),
      max: z.number(),
      target: Vec2,
      tolerance: z.number().positive(),
      describe: Describe.optional(),
      zones: z.array(Zone).default([]),
    })
    .strict(),
]);
export type Placement = z.infer<typeof Placement>;

const PlacementStep = z.object({ type: z.literal('placement'), ...StepBase, placement: Placement }).strict();

const Step = z.discriminatedUnion('type', [ChoiceStep, PlacementStep]);
export type Step = z.infer<typeof Step>;
export type ChoiceStep = z.infer<typeof ChoiceStep>;
export type PlacementStep = z.infer<typeof PlacementStep>;

const ActorRef = z.union([z.string(), Vec2]);
const Overlay = z.discriminatedUnion('type', [
  z.object({ type: z.literal('offsideLine'), actor: z.string(), label: z.string().optional() }).strict(),
  z
    .object({
      type: z.literal('distanceCircle'),
      center: ActorRef,
      radius: z.number().positive(),
      label: z.string().optional(),
      dashed: z.boolean().optional(),
      muted: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal('sightLine'), from: z.string(), to: z.string(), label: z.string().optional() }).strict(),
  z
    .object({
      type: z.literal('zone'),
      x1: z.number(),
      x2: z.number(),
      y1: z.number(),
      y2: z.number(),
      label: z.string().optional(),
    })
    .strict(),
  z.object({ type: z.literal('marker'), at: Vec2, label: z.string().optional() }).strict(),
  z.object({ type: z.literal('ruler'), from: Vec2, to: Vec2, label: z.string().optional() }).strict(),
]);
export type Overlay = z.infer<typeof Overlay>;

export const ReviewStatus = z.enum(['draft', 'inReview', 'approved']);

const QuestionBase = {
  id: z.string().regex(/^[A-J]-\d{2,3}$/, 'ID は「A-01」の形式（分野の英字 A〜J＋2〜3桁）'),
  category: Category,
  levels: z.array(Level).min(1),
  /** new2026 = 2026/27改正点 / provisional = 一部が監修前の暫定解答 */
  badges: z.array(z.enum(['new2026', 'provisional'])).default([]),
  review: z
    .object({
      status: ReviewStatus,
      note: z.string().optional(),
      reviewer: z.string().optional(),
      date: z.string().optional(),
    })
    .strict()
    .default({ status: 'draft' }),
  ruleBase: z.string().default('2026/27'),
  title: z.string().min(1),
  hint: z.string().optional(),
  steps: z.array(Step).min(1),
  explain: z
    .object({
      summary: z.string().min(1),
      detail: z.string().optional(),
      overlays: z.array(Overlay).default([]),
    })
    .strict(),
  refs: z.array(z.object({ src: z.string(), article: z.string() }).strict()).min(1, '出典（refs）は必須です'),
};

export const Question = z.discriminatedUnion('kind', [
  z.object({ ...QuestionBase, kind: z.literal('2d'), scene: Scene2D }).strict(),
  z.object({ ...QuestionBase, kind: z.literal('3d'), scene3d: Scene3D }).strict(),
  /** 図のない問題（選択式・○×）。規則の数字や手順を問う */
  z.object({ ...QuestionBase, kind: z.literal('text') }).strict(),
]);
export type Question = z.infer<typeof Question>;
export type QuestionInput = z.input<typeof Question>;

export const Source = z.object({ label: z.string(), url: z.url() }).strict();
export const Sources = z.record(z.string(), Source);
export type Sources = z.infer<typeof Sources>;

export const Glossary = z.record(z.string(), z.string());
export type Glossary = z.infer<typeof Glossary>;

export const Categories = z.record(Category, z.string());
export type Categories = z.infer<typeof Categories>;
