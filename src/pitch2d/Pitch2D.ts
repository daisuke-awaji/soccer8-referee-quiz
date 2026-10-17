/**
 * 2D ピッチ描画（SVG）・アニメーション・配置操作。
 * フィールド座標 (x: 0..68 長辺, y: 0..50 短辺) → 画面 (X = y, Y = 68 - x)
 * 赤チームは画面の上方向（x=68 の青ゴール）へ攻撃する。
 */
import type { Actor, Overlay, Placement, Scene2D, Vec2 } from '../content/schema';
import type { PlayOptions, StageEngine } from '../engine/stage';
import {
  PITCH_LENGTH as L,
  PITCH_WIDTH as W,
  compileTimeline,
  positionAt,
  toScreen as S,
  type TimedEvent,
  type Track,
} from './timeline';

const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number | null | undefined>;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}
function txt(parent: Element, x: number, y: number, str: string, cls?: string, extra?: Attrs): SVGTextElement {
  const t = el('text', { x, y, class: cls ?? '', ...extra }, parent);
  t.textContent = str;
  return t;
}

const COLORS = { red: '#e53935', blue: '#1e63d6', gkBlue: '#ffb300', gkRed: '#8e24aa', ref: '#111', refRing: '#ffeb3b' };
const OFFICIAL_LABEL: Partial<Record<Actor['role'], string>> = { referee: '主', assistant: '副', fourth: '4', assistantSingle: '補' };

export interface Pitch2DOptions {
  onCaption?: (text: string) => void;
  onEvent?: (ev: TimedEvent | { type: 'tick'; n: number }) => void;
  onProgress?: (k: number) => void;
}

interface ActorEl {
  g: SVGGElement;
  hl: SVGCircleElement;
  def: Actor;
  flag: SVGGElement | null;
}
interface OverlayItem {
  update: (t: number) => void;
}

export class Pitch2D implements StageEngine {
  readonly kind = '2d' as const;
  private readonly tracks: Record<string, Track>;
  private readonly events: TimedEvent[];
  readonly duration: number;
  private overrides: Record<string, Vec2> = {};
  private pinned = new Set<string>();
  private overlayItems: OverlayItem[] = [];
  private t = 0;
  private raf: number | null = null;
  private lastCaption: string | null = null;
  private vb = { minX: 0, minY: 0, vw: 0, vh: 0 };
  private svg!: SVGSVGElement;
  private gGrass!: SVGGElement;
  private gLines!: SVGGElement;
  private gUnder!: SVGGElement;
  private gActors!: SVGGElement;
  private gOver!: SVGGElement;
  private gBubbles!: SVGGElement;
  private gPlace!: SVGGElement;
  private actorEls: Record<string, ActorEl> = {};
  // 配置問題
  private placeCfg: Placement | null = null;
  private placeVal: Vec2 | null = null;
  private placeMarker: SVGGElement | null = null;
  private dragHint: SVGGElement | null = null;
  private listeners: Array<[string, EventListener]> = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly scene: Scene2D,
    private readonly opts: Pitch2DOptions = {},
  ) {
    const c = compileTimeline(scene.timeline);
    this.tracks = c.tracks;
    this.events = c.events;
    this.duration = c.duration;
    this.build();
    this.render(0);
  }

  pos(id: string, t: number): Vec2 | null {
    return this.overrides[id] ?? positionAt(this.tracks[id], t);
  }

  /* ------------------------------------------------ build */
  private build() {
    const v = this.scene.view ?? { x: 0, y: 0, w: L, h: W };
    const pad = this.scene.pad ?? 1.5;
    const minX = v.y - pad;
    const minY = L - (v.x + v.w) - pad;
    const vw = v.h + pad * 2;
    const vh = v.w + pad * 2;
    this.vb = { minX, minY, vw, vh };
    const svg = el('svg', {
      viewBox: [minX, minY, vw, vh].join(' '),
      class: 'pitch-svg',
      role: 'img',
      'aria-label': 'ピッチの配置図。赤チームは上の青ゴールに向かって攻撃しています。',
    });
    this.svg = svg;
    this.container.replaceChildren(svg);
    this.container.style.aspectRatio = `${vw} / ${vh}`;

    const defs = el('defs', null, svg);
    const f = el('filter', { id: 'sh', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feDropShadow', { dx: 0.12, dy: 0.22, stdDeviation: 0.18, 'flood-color': '#000', 'flood-opacity': 0.45 }, f);

    this.gGrass = el('g', null, svg);
    this.gLines = el('g', { class: 'lines' }, svg);
    this.gUnder = el('g', { class: 'ov-under' }, svg);
    this.gActors = el('g', null, svg);
    this.gOver = el('g', { class: 'ov' }, svg);
    this.gBubbles = el('g', null, svg);
    this.gPlace = el('g', { class: 'place' }, svg);

    this.drawPitch();
    this.drawActors();
  }

  private drawPitch() {
    const g = this.gGrass;
    const ln = this.gLines;
    const o = this.scene.pitch ?? {};
    const { minX, minY, vw, vh } = this.vb;
    el('rect', { x: minX, y: minY, width: vw, height: vh, fill: '#2f7d33' }, g);
    for (let y = -20, i = 0; y < 90; y += 5, i++) {
      if (i % 2) el('rect', { x: minX, y, width: vw, height: 5, fill: '#358a39' }, g);
    }
    const line: Attrs = { fill: 'none', stroke: '#fff', 'stroke-width': 0.14, 'stroke-opacity': 0.92 };
    el('rect', { x: 0, y: 0, width: W, height: L, ...line }, ln);
    el('line', { x1: 0, y1: 34, x2: W, y2: 34, ...line }, ln);
    el('circle', { cx: 25, cy: 34, r: 7, ...line }, ln);
    el('circle', { cx: 25, cy: 34, r: 0.22, fill: '#fff' }, ln);

    for (const end of [0, 1]) {
      // end 0 = 上（x=68 青ゴール）, end 1 = 下（x=0 赤ゴール）
      const gy = end === 0 ? 0 : L;
      const dir = end === 0 ? 1 : -1;
      const Y = (d: number) => gy + dir * d;
      el('rect', { x: 10.5, y: Math.min(Y(0), Y(12)), width: 29, height: 12, ...line }, ln);
      el('rect', { x: 18.5, y: Math.min(Y(0), Y(4)), width: 13, height: 4, ...line }, ln);
      if (!o.hidePenaltyMark) el('circle', { cx: 25, cy: Y(8), r: 0.24, fill: '#fff' }, ln);
      if (!o.hidePenaltyArc) {
        const dx = Math.sqrt(49 - 16);
        el('path', { d: `M ${25 - dx} ${Y(12)} A 7 7 0 0 ${end === 0 ? 0 : 1} ${25 + dx} ${Y(12)}`, ...line }, ln);
      }
      // ゴール（5m × 奥行1m の表示）
      el('rect', { x: 22.5, y: end === 0 ? -1.1 : L, width: 5, height: 1.1, fill: 'rgba(255,255,255,0.28)', stroke: '#fff', 'stroke-width': 0.14 }, ln);
    }
    // コーナーアーク r=1
    el('path', { d: 'M 1 0 A 1 1 0 0 1 0 1', ...line }, ln);
    el('path', { d: `M ${W - 1} 0 A 1 1 0 0 0 ${W} 1`, ...line }, ln);
    el('path', { d: `M 0 ${L - 1} A 1 1 0 0 1 1 ${L}`, ...line }, ln);
    el('path', { d: `M ${W} ${L - 1} A 1 1 0 0 0 ${W - 1} ${L}`, ...line }, ln);
    // 交代ゾーン（ベンチ側 y=0、ハーフウェーラインから3mずつ）
    el('rect', { x: -0.9, y: L - 37, width: 0.9, height: 6, fill: 'rgba(255,235,59,0.45)' }, ln);
    for (const xx of [31, 34, 37]) el('line', { x1: 0, y1: L - xx, x2: -0.7, y2: L - xx, ...line }, ln);

    if (o.showBench) {
      const bench = (x1: number, x2: number, color: string, label: string) => {
        const [X, Y1] = S(x2, -5.2);
        el('rect', { x: X - 1.6, y: Y1, width: 1.6, height: x2 - x1, rx: 0.3, fill: color, opacity: 0.55, stroke: '#fff', 'stroke-width': 0.08 }, ln);
        const cx = X - 2.2;
        const cy = Y1 + (x2 - x1) / 2;
        txt(ln, cx, cy, label, 'pl-small', { transform: `rotate(-90 ${cx} ${cy})`, 'text-anchor': 'middle' });
      };
      bench(22, 30, COLORS.red, '赤ベンチ');
      bench(38, 46, COLORS.blue, '青ベンチ');
    }
    if (o.showFourthTable) {
      const [X, Y] = S(35, -5.6);
      el('rect', { x: X - 1.0, y: Y, width: 1.0, height: 2, rx: 0.2, fill: '#cfd8dc', stroke: '#fff', 'stroke-width': 0.08 }, ln);
    }
  }

  private drawActors() {
    const actors = [...this.scene.actors].sort((a, b) => Number(a.role === 'ball') - Number(b.role === 'ball'));
    for (const a of actors) {
      const g = el('g', { class: `actor actor-${a.role}`, 'data-id': a.id }, this.gActors);
      const hl = el('circle', { r: 2.2, class: 'hl-ring', fill: 'none', stroke: '#ffeb3b', 'stroke-width': 0.28, opacity: 0 }, g);
      let flag: SVGGElement | null = null;
      if (a.role === 'ball') {
        el('circle', { r: 0.75, fill: '#fff', stroke: '#222', 'stroke-width': 0.16, filter: 'url(#sh)' }, g);
        el('circle', { r: 0.25, fill: '#222' }, g);
      } else if (OFFICIAL_LABEL[a.role]) {
        el('circle', { r: 1.3, fill: COLORS.ref, stroke: COLORS.refRing, 'stroke-width': 0.3, filter: 'url(#sh)' }, g);
        txt(g, 0, 0.48, OFFICIAL_LABEL[a.role]!, 'pl-num pl-ref');
        if (a.role === 'assistant') {
          flag = el('g', { class: 'flag', opacity: 0 }, g);
          el('line', { x1: 0.8, y1: -0.6, x2: 0.8, y2: -2.8, stroke: '#ddd', 'stroke-width': 0.14 }, flag);
          el('rect', { x: 0.8, y: -2.8, width: 1.3, height: 0.9, fill: '#ffeb3b', stroke: '#e53935', 'stroke-width': 0.12 }, flag);
        }
      } else {
        const gk = a.role === 'goalkeeper';
        const team = a.team ?? 'red';
        const fill = gk ? (team === 'blue' ? COLORS.gkBlue : COLORS.gkRed) : COLORS[team];
        const ring = gk ? COLORS[team] : '#fff';
        el('circle', {
          r: 1.42,
          fill,
          stroke: ring,
          'stroke-width': gk ? 0.36 : 0.2,
          filter: 'url(#sh)',
          'stroke-dasharray': a.role === 'substitute' ? '0.5 0.3' : null,
        }, g);
        txt(g, 0, 0.52, a.label ?? '', 'pl-num' + (gk ? ' pl-gk' : ''));
      }
      this.actorEls[a.id] = { g, hl, def: a, flag };
    }
    const sp = this.scene.spotlight ? this.actorEls[this.scene.spotlight] : undefined;
    if (sp) {
      sp.hl.setAttribute('opacity', '1');
      sp.hl.classList.add('pulse');
    }
  }

  /* ------------------------------------------------ overlays（解説） */
  setOverlays(list: Overlay[]) {
    this.gOver.replaceChildren();
    this.gUnder.replaceChildren();
    this.overlayItems = list.map((d) => this.makeOverlay(d)).filter((x): x is OverlayItem => !!x);
    this.render(this.t);
  }
  private label(parent: Element, str: string, cls = ''): SVGTextElement {
    return txt(parent, 0, 0, str, 'ov-label ' + cls);
  }
  private makeOverlay(d: Overlay): OverlayItem | null {
    const set = (e: Element, attrs: Attrs) => {
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    };
    switch (d.type) {
      case 'offsideLine': {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const l = el('line', { x1: -0.5, x2: W + 0.5, stroke: '#ffeb3b', 'stroke-width': 0.24, 'stroke-dasharray': '1 0.5' }, g);
        const t = this.label(g, d.label ?? '', 'ov-yellow');
        t.setAttribute('text-anchor', 'start');
        return {
          update: (tt) => {
            const p = this.pos(d.actor, tt);
            if (!p) return;
            const Y = L - p[0];
            set(l, { y1: Y, y2: Y });
            set(t, { x: 0.6, y: Y - 0.7 });
          },
        };
      }
      case 'distanceCircle': {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const c = el('circle', {
          r: d.radius,
          fill: d.muted ? 'none' : 'rgba(255,255,255,0.10)',
          stroke: d.muted ? 'rgba(255,255,255,0.75)' : '#fff',
          'stroke-width': 0.2,
          'stroke-dasharray': d.dashed ? '0.8 0.5' : null,
        }, g);
        const t = this.label(g, d.label ?? '', d.muted ? 'ov-muted' : '');
        t.setAttribute('text-anchor', 'end');
        return {
          update: (tt) => {
            const p = Array.isArray(d.center) ? (d.center as Vec2) : this.pos(d.center, tt);
            if (!p) return;
            const [X, Y] = S(p[0], p[1]);
            set(c, { cx: X, cy: Y });
            const ang = d.muted ? 2.55 : 2.2;
            set(t, { x: X + d.radius * Math.cos(ang) - 0.4, y: Y + d.radius * Math.sin(ang) + 1.4 });
          },
        };
      }
      case 'sightLine': {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const l = el('line', { stroke: '#80deea', 'stroke-width': 0.2, 'stroke-dasharray': '0.6 0.4' }, g);
        const t = this.label(g, d.label ?? '', 'ov-cyan');
        return {
          update: (tt) => {
            const a = this.pos(d.from, tt);
            const b = this.pos(d.to, tt);
            if (!a || !b) return;
            const A = S(a[0], a[1]);
            const B = S(b[0], b[1]);
            set(l, { x1: A[0], y1: A[1], x2: B[0], y2: B[1] });
            set(t, { x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2 + 2.2 });
          },
        };
      }
      case 'zone': {
        const g = el('g', { class: 'ov-item' }, this.gUnder);
        const [X1, Y1] = S(d.x2, d.y1);
        el('rect', { x: X1, y: Y1, width: d.y2 - d.y1, height: d.x2 - d.x1, fill: 'rgba(255,235,59,0.35)', stroke: '#ffeb3b', 'stroke-width': 0.18 }, g);
        const t = this.label(this.gOver, d.label ?? '', 'ov-yellow');
        set(t, { x: X1 + (d.y2 - d.y1) + 0.8, y: Y1 + (d.x2 - d.x1) / 2 + 0.5, 'text-anchor': 'start' });
        return { update: () => {} };
      }
      case 'marker': {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const [X, Y] = S(d.at[0], d.at[1]);
        el('circle', { cx: X, cy: Y, r: 0.45, fill: '#fff' }, g);
        el('circle', { cx: X, cy: Y, r: 1.2, fill: 'none', stroke: '#69f0ae', 'stroke-width': 0.22 }, g);
        return { update: () => {} };
      }
      case 'ruler': {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const A = S(d.from[0], d.from[1]);
        const B = S(d.to[0], d.to[1]);
        el('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: '#69f0ae', 'stroke-width': 0.2 }, g);
        for (const p of [A, B]) el('line', { x1: p[0] - 0.7, y1: p[1], x2: p[0] + 0.7, y2: p[1], stroke: '#69f0ae', 'stroke-width': 0.2 }, g);
        const t = this.label(g, d.label ?? '', 'ov-green');
        set(t, { x: A[0] - 1.0, y: (A[1] + B[1]) / 2 + 0.5, 'text-anchor': 'end' });
        return { update: () => {} };
      }
    }
  }

  /* ------------------------------------------------ render */
  render(t: number) {
    this.t = t;
    for (const [id, a] of Object.entries(this.actorEls)) {
      const p = this.pos(id, t);
      if (!p) {
        a.g.setAttribute('display', 'none');
        continue;
      }
      a.g.removeAttribute('display');
      const [X, Y] = S(p[0], p[1]);
      a.g.setAttribute('transform', `translate(${X.toFixed(3)} ${Y.toFixed(3)})`);
      if (id !== this.scene.spotlight && !this.pinned.has(id)) a.hl.setAttribute('opacity', '0');
    }
    // イベント: 強調・吹き出し・字幕
    this.gBubbles.replaceChildren();
    let caption = '';
    for (const ev of this.events) {
      if (ev.t > t + 1e-6) continue;
      const age = t - ev.t;
      if (ev.type === 'caption') caption = ev.text;
      else if (ev.type === 'highlight') {
        const a = this.actorEls[ev.actor];
        if (a && age <= (ev.dur ?? 1.5)) a.hl.setAttribute('opacity', '1');
      } else if (ev.type === 'whistle' && age <= 0.9) this.bubble('REF', 'ピッ！', 'bub-whistle');
      else if (ev.type === 'countdown' && age <= ev.dur + 0.5) {
        const n = Math.max(0, Math.ceil(ev.from - age));
        this.bubble(ev.by, String(n), 'bub-count' + (n === 0 ? ' bub-zero' : ''));
      } else if (ev.type === 'flag') {
        const a = this.actorEls[ev.by];
        if (a?.flag) a.flag.setAttribute('opacity', age <= (ev.dur ?? 99) ? '1' : '0');
      }
    }
    if (this.opts.onCaption && caption !== this.lastCaption) {
      this.lastCaption = caption;
      this.opts.onCaption(caption);
    }
    for (const o of this.overlayItems) o.update(t);
  }
  private bubble(actorId: string, str: string, cls: string) {
    const p = this.pos(actorId, this.t);
    if (!p) return;
    const [X, Y] = S(p[0], p[1]);
    const g = el('g', { class: 'bubble ' + cls, transform: `translate(${X} ${Y - 3.6})` }, this.gBubbles);
    const w = Math.max(4.6, str.length * 1.6);
    el('rect', { x: -w / 2, y: -1.6, width: w, height: 2.9, rx: 0.8 }, g);
    el('path', { d: 'M -0.6 1.3 L 0 2.2 L 0.6 1.3 Z' }, g);
    txt(g, 0, 0.6, str, 'bub-text');
  }

  /* ------------------------------------------------ 再生 */
  play(o: PlayOptions = {}) {
    this.stop();
    const from = o.from ?? 0;
    const to = o.to ?? this.duration;
    const speed = o.speed ?? 1;
    this.t = from;
    this.lastCaption = null;
    let last = performance.now();
    let prevT = from;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      const nt = Math.min(to, this.t + dt);
      if (this.opts.onEvent) {
        for (const ev of this.events) {
          if (ev.t > prevT && ev.t <= nt) this.opts.onEvent(ev);
          if (ev.type === 'countdown') {
            const a = Math.floor(prevT - ev.t);
            const b = Math.floor(nt - ev.t);
            if (b > a && b >= 1 && b <= ev.dur) this.opts.onEvent({ type: 'tick', n: ev.from - b });
          }
        }
      }
      prevT = nt;
      this.render(nt);
      this.opts.onProgress?.((nt - from) / Math.max(0.001, to - from));
      if (nt >= to) {
        this.raf = null;
        o.onEnd?.();
        return;
      }
      this.raf = requestAnimationFrame(step);
    };
    if (from === 0 && this.opts.onEvent) for (const ev of this.events) if (ev.t === 0) this.opts.onEvent(ev);
    this.render(from);
    this.raf = requestAnimationFrame(step);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
  get playing() {
    return this.raf !== null;
  }
  seek(t: number) {
    this.stop();
    this.render(t);
  }

  /* ------------------------------------------------ 配置問題 */
  private toField(evt: PointerEvent): Vec2 | null {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return [L - p.y, p.x];
  }
  private on<K extends keyof SVGElementEventMap>(name: K, fn: (e: SVGElementEventMap[K]) => void) {
    this.svg.addEventListener(name, fn as EventListener);
    this.listeners.push([name, fn as EventListener]);
  }
  enablePlacement(cfg: Placement, onChange: (p: Vec2) => void) {
    this.placeCfg = cfg;
    this.placeVal = null;
    this.svg.classList.add('placing');
    let dragging = false;
    if (cfg.mode === 'line') {
      const a = this.actorEls[cfg.actor];
      if (a) {
        a.g.classList.add('draggable');
        this.pinned.add(cfg.actor);
        a.hl.setAttribute('opacity', '1');
        a.hl.classList.add('pulse');
        const hint = el('g', { class: 'drag-hint' }, a.g);
        txt(hint, 0, -2.6, '▲', 'drag-arrow');
        txt(hint, 0, 4.2, '▼', 'drag-arrow');
        this.dragHint = hint;
      }
    } else {
      this.placeMarker = el('g', { class: 'place-marker', display: 'none' }, this.gPlace);
      el('circle', { r: 1.4, fill: 'rgba(255,255,255,0.25)', stroke: '#fff', 'stroke-width': 0.2 }, this.placeMarker);
      el('circle', { r: 0.32, fill: '#fff' }, this.placeMarker);
      txt(this.placeMarker, 0, -2.0, cfg.marker ?? 'ここ', 'ov-label');
    }
    const apply = (p: Vec2 | null) => {
      if (!p) return;
      if (cfg.mode === 'line') {
        const x = Math.max(cfg.min, Math.min(cfg.max, p[0]));
        this.placeVal = [x, cfg.fixedY];
        this.overrides[cfg.actor] = this.placeVal;
        if (this.dragHint) {
          this.dragHint.remove();
          this.dragHint = null;
        }
      } else {
        const x = Math.max(34, Math.min(L, p[0]));
        const y = Math.max(0, Math.min(W, p[1]));
        this.placeVal = [x, y];
        const [X, Y] = S(x, y);
        this.placeMarker?.removeAttribute('display');
        this.placeMarker?.setAttribute('transform', `translate(${X} ${Y})`);
      }
      this.render(this.t);
      onChange(this.placeVal);
    };
    this.on('pointerdown', (e) => {
      dragging = true;
      try {
        this.svg.setPointerCapture(e.pointerId);
      } catch {
        /* 対応していないブラウザ */
      }
      apply(this.toField(e));
      e.preventDefault();
    });
    this.on('pointermove', (e) => {
      if (!dragging) return;
      apply(this.toField(e));
      e.preventDefault();
    });
    this.on('pointerup', () => (dragging = false));
    this.on('pointercancel', () => (dragging = false));
    // キーボード操作（アクセシビリティ）
    this.svg.setAttribute('tabindex', '0');
    this.on('keydown', (e) => {
      const cur = this.placeVal ?? (cfg.mode === 'line' ? this.pos(cfg.actor, this.t) : null) ?? [52, 25];
      const st = e.shiftKey ? 2 : 0.5;
      const map: Record<string, Vec2> = { ArrowUp: [st, 0], ArrowDown: [-st, 0], ArrowLeft: [0, -st], ArrowRight: [0, st] };
      const d = map[e.key];
      if (d) {
        apply([cur[0] + d[0], cur[1] + d[1]]);
        e.preventDefault();
      }
    });
  }
  disablePlacement() {
    if (!this.svg) return;
    this.svg.classList.remove('placing');
    for (const [n, fn] of this.listeners) this.svg.removeEventListener(n, fn);
    this.listeners = [];
    const cfg = this.placeCfg;
    if (cfg?.mode === 'line') {
      const a = this.actorEls[cfg.actor];
      if (a) {
        a.g.classList.remove('draggable');
        a.hl.classList.remove('pulse');
      }
      this.pinned.delete(cfg.actor);
    }
  }
  showPlacementResult(user: Vec2 | null, cfg: Placement, ok: boolean) {
    const g = el('g', { class: 'place-result' }, this.gPlace);
    const T = S(cfg.target[0], cfg.target[1]);
    if (cfg.mode === 'line') {
      const y1 = L - (cfg.target[0] + cfg.tolerance);
      const h = cfg.tolerance * 2;
      el('rect', { x: 0, y: y1, width: W, height: h, fill: 'rgba(105,240,174,0.16)' }, g);
      el('rect', { x: W - 0.3, y: y1, width: 3, height: h, fill: 'rgba(105,240,174,0.55)', stroke: '#69f0ae', 'stroke-width': 0.18 }, g);
      txt(g, W - 1.0, y1 - 0.5, '正解の範囲', 'ov-label ov-green', { 'text-anchor': 'end' });
      const ghost = el('g', { transform: `translate(${T[0]} ${T[1]})`, opacity: ok ? 0 : 0.9 }, g);
      el('circle', { r: 1.1, fill: 'none', stroke: '#69f0ae', 'stroke-width': 0.3, 'stroke-dasharray': '0.4 0.25' }, ghost);
      txt(ghost, -1.8, 0.4, '正解', 'ov-label ov-green', { 'text-anchor': 'end' });
    } else {
      el('circle', { cx: T[0], cy: T[1], r: cfg.tolerance, fill: 'rgba(105,240,174,0.3)', stroke: '#69f0ae', 'stroke-width': 0.15 }, g);
      el('circle', { cx: T[0], cy: T[1], r: 0.3, fill: '#69f0ae' }, g);
      if (user) {
        const U = S(user[0], user[1]);
        if (!ok) el('line', { x1: U[0], y1: U[1], x2: T[0], y2: T[1], stroke: '#ff8a80', 'stroke-width': 0.16, 'stroke-dasharray': '0.4 0.3' }, g);
        if (this.placeMarker) {
          this.placeMarker.classList.add(ok ? 'ok' : 'ng');
          const lt = this.placeMarker.querySelector('text');
          if (lt) lt.textContent = 'あなた';
        }
        txt(g, T[0] + cfg.tolerance + 0.6, T[1] + 0.5, '正解', 'ov-label ov-green', { 'text-anchor': 'start' });
      }
    }
  }

  destroy() {
    this.stop();
    this.disablePlacement();
    this.container.replaceChildren();
  }
}
