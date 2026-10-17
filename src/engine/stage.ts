/** 2D・3D の再生エンジンに共通の操作 */
export interface PlayOptions {
  from?: number;
  to?: number;
  speed?: number;
  onEnd?: () => void;
}

export interface StageEngine {
  readonly kind: '2d' | '3d';
  play(o?: PlayOptions): void;
  stop(): void;
  seek(t: number): void;
  readonly playing: boolean;
  destroy(): void;
}
