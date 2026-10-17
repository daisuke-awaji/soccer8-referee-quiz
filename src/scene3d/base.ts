/**
 * 3D シーンの共通部分：描画の準備、視点の移動、再生（再生・停止・シーク）、後片付け。
 * シーンごとのクラスは、人物の動き（pose）と視点（cams）を書く。
 */
import * as THREE from 'three';
import type { Scene3DDef } from '../content/schema';
import type { PlayOptions } from '../engine/stage';
import type { CameraTab, LegendItem, Scene3DEngine, Scene3DOptions } from './index';
import { buildField } from './kit';
import { lerp, smooth } from './pose';

export type V3 = [number, number, number];
export interface Cam {
  pos: V3;
  target: V3;
  /** 縦の画角（度） */
  fov: number;
  up: V3;
  /** 横の画角（度）。指定すると、画面の縦横比に合わせて fov を決める */
  hfov?: number;
  /**
   * 人物とボールの拡大率（省略時 1 = 実寸）。遠くから見下ろす視点で、だれがどのチームか
   * 分かるように大きくする。審判の目の高さの視点は、隠れ方が変わらないよう実寸にする
   */
  people?: number;
}

export const vfovFromH = (hfov: number, aspect: number) =>
  (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI;

export abstract class Scene3DBase implements Scene3DEngine {
  readonly kind = '3d' as const;
  abstract readonly cameras: ReadonlyArray<CameraTab>;
  abstract readonly initialCamera: string;
  abstract readonly explainCamera: string;
  abstract readonly contactAt: number;
  abstract readonly contactLabel: string;
  abstract readonly legend: ReadonlyArray<LegendItem>;

  protected t = 0;
  protected camId = '';
  protected analysis = false;
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene = new THREE.Scene();
  protected readonly camera = new THREE.PerspectiveCamera(36, 4 / 3, 0.1, 200);
  private raf: number | null = null;
  private isPlaying = false;
  private from = 0;
  private to = 0;
  private speed = 1;
  private onEnd: (() => void) | null = null;
  private camAnim: { from: Cam; to: Cam; k: number; dur: number } | null = null;
  private camCur: Cam | null = null;
  private ro: ResizeObserver | null = null;
  /** 視点の people に合わせて大きさを変えるもの（人物・ボール） */
  protected readonly scalable: THREE.Object3D[] = [];

  constructor(
    protected readonly container: HTMLElement,
    protected readonly def: Scene3DDef,
    protected readonly opts: Scene3DOptions,
    ariaLabel: string,
    goalLineX: number,
  ) {
    const canvas = document.createElement('canvas');
    canvas.className = 'scene3d-canvas';
    canvas.setAttribute('aria-label', ariaLabel);
    container.replaceChildren(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color('#cfe6fb');
    this.scene.fog = new THREE.Fog('#cfe6fb', 45, 110);
    this.scene.add(new THREE.HemisphereLight('#eef6ff', '#41633a', 1.1));
    const dl = new THREE.DirectionalLight('#ffffff', 1.4);
    dl.position.set(12, 22, 9);
    this.scene.add(dl);
    buildField(this.scene, goalLineX);
  }

  /** 視点の定義（id → カメラ） */
  protected abstract cam(id: string): Cam;
  /** 時刻 t の人物・ボールの位置を反映する */
  protected abstract pose(t: number): void;
  /** 毎フレームの追加の動き（解説の印の点滅など）。動かし続けるなら true */
  protected frame(_now: number): boolean {
    return false;
  }
  /** 描画の直前（ラベルの大きさ合わせなど） */
  protected beforeRender(): void {}

  /** サブクラスのコンストラクタの最後に呼ぶ */
  protected start(): void {
    this.camId = this.initialCamera;
    this.resize();
    this.applyCam(this.cam(this.camId));
    this.ro = new ResizeObserver(() => {
      this.resize();
      if (!this.camAnim) this.applyCam(this.cam(this.camId));
      this.renderOnce();
    });
    this.ro.observe(this.container);
    this.seek(0);
  }

  protected update(t: number) {
    this.t = t;
    this.pose(t);
    this.opts.onTime?.(t);
  }
  protected renderOnce() {
    this.beforeRender();
    this.renderer.render(this.scene, this.camera);
  }
  private resize() {
    const w = this.container.clientWidth || 320;
    const h = this.container.clientHeight || 240;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private resolve(c: Cam): Cam {
    return c.hfov ? { ...c, fov: vfovFromH(c.hfov, this.camera.aspect) } : c;
  }
  private applyCam(c0: Cam) {
    const c = this.resolve(c0);
    this.camera.position.set(...c.pos);
    this.camera.up.set(...c.up);
    this.camera.fov = c.fov;
    this.camera.lookAt(...c.target);
    this.camera.updateProjectionMatrix();
    const s = c.people ?? 1;
    for (const o of this.scalable) o.scale.setScalar(s);
    this.camCur = { pos: [...c.pos], target: [...c.target], fov: c.fov, up: [...c.up], people: s };
  }
  protected loop() {
    if (this.raf) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let busy = false;
      if (this.isPlaying) {
        busy = true;
        const nt = Math.min(this.to, this.t + dt * this.speed);
        this.update(nt);
        this.opts.onProgress?.((nt - this.from) / Math.max(0.001, this.to - this.from));
        if (nt >= this.to) {
          this.isPlaying = false;
          const cb = this.onEnd;
          this.onEnd = null;
          cb?.();
        }
      }
      if (this.camAnim) {
        busy = true;
        const a = this.camAnim;
        a.k = Math.min(1, a.k + dt / a.dur);
        const e = smooth(a.k);
        const mix = (p: V3, q: V3): V3 => [lerp(p[0], q[0], e), lerp(p[1], q[1], e), lerp(p[2], q[2], e)];
        const to = this.resolve(a.to);
        this.applyCam({ pos: mix(a.from.pos, to.pos), target: mix(a.from.target, to.target), fov: lerp(a.from.fov, to.fov, e), up: mix(a.from.up, to.up), people: lerp(a.from.people ?? 1, to.people ?? 1, e) });
        if (a.k >= 1) this.camAnim = null;
      }
      if (this.frame(now)) busy = true;
      this.renderOnce();
      this.raf = busy ? requestAnimationFrame(step) : null;
    };
    this.raf = requestAnimationFrame(step);
  }

  /* ---------------- 公開 API */
  play(o: PlayOptions = {}) {
    this.from = o.from ?? 0;
    this.to = o.to ?? this.def.endAt;
    this.speed = o.speed ?? 1;
    this.onEnd = o.onEnd ?? null;
    this.update(this.from);
    this.isPlaying = true;
    this.loop();
  }
  stop() {
    this.isPlaying = false;
    this.onEnd = null;
  }
  get playing() {
    return this.isPlaying;
  }
  seek(t: number) {
    this.stop();
    this.update(t);
    this.renderOnce();
    this.loop();
  }
  setCamera(id: string, animate = true) {
    const c = this.cam(id);
    this.camId = id;
    this.update(this.t);
    if (!animate || !this.camCur) {
      this.applyCam(c);
      this.renderOnce();
      return;
    }
    this.camAnim = { from: this.camCur, to: c, k: 0, dur: 0.7 };
    this.loop();
  }
  setAnalysis(on: boolean) {
    this.analysis = on;
    this.update(this.t);
    this.renderOnce();
    this.loop();
  }
  destroy() {
    this.stop();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ro?.disconnect();
    try {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    } catch {
      /* すでに破棄されている */
    }
    this.container.replaceChildren();
  }
}
