/** 出題の順番と成績の集計（DOM・保存に依存しない） */
import type { Category, Question, Stage } from '../content/schema';
import type { AppState, QuestionResult } from '../storage/store';

/** ステージを始める（retry のときは、前の成績を残したまま間違えた問題だけを解き直す） */
export function startStagePatch(
  stage: Stage,
  prev: AppState,
  ids?: string[],
  round: AppState['round'] = 'main',
): Partial<AppState> {
  return {
    stage: stage.id,
    order: ids ?? [...stage.questions],
    idx: 0,
    results: round === 'retry' ? prev.results : {},
    round,
    finished: false,
  };
}

/** 最後の問題まで終えたとき。ステージ全体の正解数を記録する（とばした問題は不正解と同じ） */
export function finishPatch(s: AppState, stages: Readonly<Record<string, Stage>>): Partial<AppState> {
  const stage = s.stage ? stages[s.stage] : undefined;
  if (!stage) return { finished: true };
  const score = stage.questions.filter((id) => s.results[id]?.ok).length;
  return {
    finished: true,
    stageScores: { ...s.stageScores, [stage.id]: { score, total: stage.questions.length, at: Date.now() } },
  };
}

export function isInProgress(s: AppState): boolean {
  return !!s.stage && s.order.length > 0 && !s.finished && (s.idx > 0 || Object.keys(s.results).length > 0);
}

export interface Summary {
  score: number;
  total: number;
  ratio: number;
  wrong: string[];
  categories: Array<{ category: Category; ok: number; n: number }>;
}

export function summarize(order: readonly string[], results: Record<string, QuestionResult>, qmap: Readonly<Record<string, Question>>): Summary {
  const counted = order.filter((id) => results[id] && !results[id]!.skipped && qmap[id]);
  const score = counted.filter((id) => results[id]!.ok).length;
  const total = counted.length;
  const cats = new Map<Category, { ok: number; n: number }>();
  for (const id of counted) {
    const c = qmap[id]!.category;
    const v = cats.get(c) ?? { ok: 0, n: 0 };
    v.n++;
    if (results[id]!.ok) v.ok++;
    cats.set(c, v);
  }
  return {
    score,
    total,
    ratio: total ? score / total : 0,
    wrong: counted.filter((id) => !results[id]!.ok),
    categories: [...cats].map(([category, v]) => ({ category, ...v })),
  };
}

export function resultMessage(ratio: number): string {
  if (ratio >= 0.9) return 'ほとんどの問題に正解しました。';
  if (ratio >= 0.6) return '間違えた問題は、解説をもう一度見ておくと確実です。';
  return '解説で動きと判定の関係を確かめてから、もう一度解いてみてください。';
}
