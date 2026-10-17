/**
 * 3D シーンの入口。three.js を含むシーン本体は、3D の問題を開いたときだけ読み込む（別ファイルに分割される）。
 */
import type { Position3DCandidate, Scene3DDef } from '../content/schema';
import type { StageEngine } from '../engine/stage';

export interface CameraTab {
  id: string;
  label: string;
}
export interface LegendItem {
  cls: string;
  label: string;
}

export interface Scene3DOptions {
  onProgress?: (k: number) => void;
  onTime?: (t: number) => void;
}

export interface Scene3DEngine extends StageEngine {
  readonly kind: '3d';
  /** 視点の切り替えタブ（立ち位置の候補を出すと増える） */
  readonly cameras: ReadonlyArray<CameraTab>;
  /** 解答前に使える視点 */
  readonly initialCamera: string;
  /** 解説に入ったときの視点 */
  readonly explainCamera: string;
  readonly contactAt: number;
  /** 「接触の瞬間」ボタンの文言 */
  readonly contactLabel: string;
  readonly legend: ReadonlyArray<LegendItem>;
  setCamera(id: string, animate?: boolean): void;
  setAnalysis(on: boolean): void;
  /** 立ち位置の候補をフィールドに出す（立ち位置を選ぶ問題のあるシーンだけ） */
  showCandidates?(list: ReadonlyArray<Position3DCandidate>, onPick: (id: string) => void): void;
  selectCandidate?(id: string | null): void;
  /** 解答後：候補を選べなくし、正解と選んだ位置を示す */
  revealCandidates?(answer: string, picked: string | null): void;
}

type SceneModule = { create: (container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions) => Scene3DEngine };

const loaders: Record<Scene3DDef['id'], () => Promise<SceneModule>> = {
  slidingTackle: () => import('./scenes/slidingTackle'),
  penaltyAreaPush: () => import('./scenes/penaltyAreaPush'),
};

/** WebGL が使えるか（使えない端末では案内を出す） */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function createScene3D(container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions = {}): Promise<Scene3DEngine> {
  if (!hasWebGL()) throw new Error('WebGL is not available');
  const mod = await loaders[def.id]();
  return mod.create(container, def, opts);
}

/** 次に3Dの問題が来るときに先読みしておく */
export function preloadScene3D(id: Scene3DDef['id']): void {
  loaders[id]().catch(() => {});
}
