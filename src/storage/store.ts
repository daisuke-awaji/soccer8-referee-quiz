/**
 * 端末内（localStorage）に保存する進み具合・設定・感想。サーバーには送らない。
 * 保存形式にはバージョンを付け、古い形式（試作版 v0.1）から引き継げるようにする。
 */
import { useSyncExternalStore } from 'react';

export const STORAGE_KEY = 'ref8quiz.v3';
/** 以前の保存先（新しいものから順に読む） */
export const LEGACY_KEYS = ['ref8quiz.v2', 'ref8quiz.v1'];

export interface QuestionResult {
  ok?: boolean;
  /** 正解した手順の数 / 手順の数 */
  n?: number;
  total?: number;
  hint?: boolean;
  views?: number;
  skipped?: boolean;
  at: number;
}

/** ステージを最後に解き終えたときの正解数 */
export interface StageScore {
  score: number;
  total: number;
  at: number;
}

export interface AppState {
  version: 3;
  /** 今解いているステージ（null は未選択） */
  stage: string | null;
  order: string[];
  idx: number;
  results: Record<string, QuestionResult>;
  notes: string;
  settings: { sound: boolean; haptics: boolean };
  round: 'main' | 'retry';
  finished: boolean;
  stageScores: Record<string, StageScore>;
}

export const defaultState = (): AppState => ({
  version: 3,
  stage: null,
  order: [],
  idx: 0,
  results: {},
  notes: '',
  settings: { sound: true, haptics: true },
  round: 'main',
  finished: false,
  stageScores: {},
});

/**
 * 保存されていた値を、今の形式に直す（壊れていたら初期値）。
 * v2 以前は全問を通して解く形だったので、途中の出題は引き継がない（成績・感想・設定は残す）。
 */
export function migrate(raw: unknown, knownIds?: ReadonlySet<string>, knownStages?: ReadonlySet<string>): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState> & { version?: number };
  const v3 = s.version === 3;
  const out: AppState = {
    ...base,
    stage: v3 && typeof s.stage === 'string' ? s.stage : null,
    order: Array.isArray(s.order) ? s.order.filter((x): x is string => typeof x === 'string') : [],
    idx: typeof s.idx === 'number' && s.idx >= 0 ? s.idx : 0,
    results: s.results && typeof s.results === 'object' ? s.results : {},
    notes: typeof s.notes === 'string' ? s.notes : '',
    settings: { sound: s.settings?.sound !== false, haptics: s.settings?.haptics !== false },
    round: s.round === 'retry' ? 'retry' : 'main',
    finished: !!s.finished,
    stageScores: v3 && s.stageScores && typeof s.stageScores === 'object' ? s.stageScores : {},
  };
  // 古い形式・ステージ未選択、または問題・ステージが削除・改名されていたら、途中の出題をやめる
  if (
    !out.stage ||
    (knownStages && !knownStages.has(out.stage)) ||
    (knownIds && out.order.some((id) => !knownIds.has(id)))
  ) {
    out.stage = null;
    out.order = [];
    out.idx = 0;
    out.finished = false;
  }
  if (knownStages) for (const k of Object.keys(out.stageScores)) if (!knownStages.has(k)) delete out.stageScores[k];
  if (out.idx > out.order.length) out.idx = out.order.length;
  return out;
}

function read(key: string): unknown {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

type Listener = () => void;

export function createStore(knownIds?: ReadonlySet<string>, knownStages?: ReadonlySet<string>) {
  let state: AppState = migrate(read(STORAGE_KEY) ?? LEGACY_KEYS.map(read).find((x) => x) ?? null, knownIds, knownStages);
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* プライベートモードなどで保存できない */
      }
      for (const l of listeners) l();
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export function useAppState(store: Store): AppState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
