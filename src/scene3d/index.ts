/**
 * 3D シーンの入口。three.js を含むシーン本体は、3D の問題を開いたときだけ読み込む（別ファイルに分割される）。
 */
import type { Scene3DDef } from '../content/schema';
import type { StageEngine } from '../engine/stage';

export type CameraId = 'referee' | 'assistant' | 'side' | 'top';
export const CAMERAS: ReadonlyArray<{ id: CameraId; label: string }> = [
  { id: 'referee', label: '主審の位置' },
  { id: 'assistant', label: '副審の位置' },
  { id: 'side', label: '真横' },
  { id: 'top', label: '真上' },
];

export interface Scene3DOptions {
  onProgress?: (k: number) => void;
  onTime?: (t: number) => void;
}

export interface Scene3DEngine extends StageEngine {
  readonly kind: '3d';
  setCamera(id: CameraId, animate?: boolean): void;
  setAnalysis(on: boolean): void;
  readonly contactAt: number;
}

type SceneModule = { create: (container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions) => Scene3DEngine };

const loaders: Record<Scene3DDef['id'], () => Promise<SceneModule>> = {
  slidingTackle: () => import('./scenes/slidingTackle'),
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
