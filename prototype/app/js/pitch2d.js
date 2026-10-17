/* 2D ピッチ描画・アニメーション・配置操作
 * フィールド座標 (x: 0..68 長辺, y: 0..50 短辺) → 画面 (X = y, Y = 68 - x)
 * 赤チームは画面上方向（x=68 の青ゴール）へ攻撃する。
 */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const L = 68, W = 50;
  const S = (x, y) => [y, L - x];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, str, cls, extra) {
    const t = el('text', Object.assign({ x: x, y: y, class: cls || '' }, extra || {}), parent);
    t.textContent = str;
    return t;
  }

  const COLORS = {
    red: '#e53935', blue: '#1e63d6', gkBlue: '#ffb300', gkRed: '#8e24aa',
    ref: '#111', refRing: '#ffeb3b'
  };

  class Pitch2D {
    constructor(container, scene, opts) {
      this.c = container;
      this.scene = scene;
      this.opts = opts || {};
      this.mode = 'play';
      this.overrides = {};
      this.pinned = new Set();
      this.overlayDefs = [];
      this.t = 0;
      this._raf = null;
      this._buildTracks();
      this._build();
      this.render(0);
    }

    /* ------------------------------------------------ data */
    _buildTracks() {
      const tracks = {};
      const events = [];
      (this.scene.timeline || []).forEach(kf => {
        Object.keys(kf.positions || {}).forEach(id => {
          (tracks[id] = tracks[id] || []).push([kf.t, kf.positions[id][0], kf.positions[id][1]]);
        });
        (kf.events || []).forEach(ev => events.push(Object.assign({ t: kf.t }, ev)));
      });
      Object.values(tracks).forEach(a => a.sort((p, q) => p[0] - q[0]));
      this.tracks = tracks;
      this.events = events.sort((a, b) => a.t - b.t);
      const tl = this.scene.timeline || [];
      this.duration = tl.length ? tl[tl.length - 1].t : 0;
    }
    pos(id, t) {
      if (this.overrides[id]) return this.overrides[id];
      const tr = this.tracks[id];
      if (!tr || !tr.length) return null;
      if (t <= tr[0][0]) return [tr[0][1], tr[0][2]];
      for (let i = 1; i < tr.length; i++) {
        if (t <= tr[i][0]) {
          const a = tr[i - 1], b = tr[i];
          const k = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]);
          return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
        }
      }
      const z = tr[tr.length - 1];
      return [z[1], z[2]];
    }

    /* ------------------------------------------------ build */
    _build() {
      const v = this.scene.view || { x: 0, y: 0, w: L, h: W };
      const pad = this.scene.pad != null ? this.scene.pad : 1.5;
      const minX = v.y - pad, minY = L - (v.x + v.w) - pad;
      const vw = v.h + pad * 2, vh = v.w + pad * 2;
      this.vb = { minX, minY, vw, vh };
      const svg = el('svg', {
        viewBox: [minX, minY, vw, vh].join(' '),
        class: 'pitch-svg', role: 'img',
        'aria-label': 'ピッチの配置図。赤チームは上の青ゴールに向かって攻撃しています。'
      });
      this.svg = svg;
      this.c.innerHTML = '';
      this.c.appendChild(svg);
      this.c.style.aspectRatio = vw + ' / ' + vh;

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

      this._drawPitch();
      this._drawActors();
    }

    _drawPitch() {
      const g = this.gGrass, ln = this.gLines;
      const o = this.scene.pitch || {};
      const { minX, minY, vw, vh } = this.vb;
      el('rect', { x: minX, y: minY, width: vw, height: vh, fill: '#2f7d33' }, g);
      for (let y = -20, i = 0; y < 90; y += 5, i++) {
        if (i % 2) el('rect', { x: minX, y: y, width: vw, height: 5, fill: '#358a39' }, g);
      }
      const line = { fill: 'none', stroke: '#fff', 'stroke-width': 0.14, 'stroke-opacity': 0.92 };
      el('rect', Object.assign({ x: 0, y: 0, width: W, height: L }, line), ln);
      el('line', Object.assign({ x1: 0, y1: 34, x2: W, y2: 34 }, line), ln);
      el('circle', Object.assign({ cx: 25, cy: 34, r: 7 }, line), ln);
      el('circle', { cx: 25, cy: 34, r: 0.22, fill: '#fff' }, ln);

      [0, 1].forEach(end => {
        // end 0 = 上（x=68 青ゴール）, end 1 = 下（x=0 赤ゴール）
        const gy = end === 0 ? 0 : L, dir = end === 0 ? 1 : -1;
        const Y = d => gy + dir * d;
        el('rect', Object.assign({ x: 10.5, y: Math.min(Y(0), Y(12)), width: 29, height: 12 }, line), ln);
        el('rect', Object.assign({ x: 18.5, y: Math.min(Y(0), Y(4)), width: 13, height: 4 }, line), ln);
        if (!o.hidePenaltyMark) el('circle', { cx: 25, cy: Y(8), r: 0.24, fill: '#fff' }, ln);
        if (!o.hidePenaltyArc) {
          const dx = Math.sqrt(49 - 16);
          el('path', Object.assign({ d: 'M ' + (25 - dx) + ' ' + Y(12) + ' A 7 7 0 0 ' + (end === 0 ? 0 : 1) + ' ' + (25 + dx) + ' ' + Y(12) }, line), ln);
        }
        // ゴール（5m × 奥行1m の表示）
        el('rect', { x: 22.5, y: end === 0 ? -1.1 : L, width: 5, height: 1.1, fill: 'rgba(255,255,255,0.28)', stroke: '#fff', 'stroke-width': 0.14 }, ln);
      });
      // コーナーアーク r=1
      el('path', Object.assign({ d: 'M 1 0 A 1 1 0 0 1 0 1' }, line), ln);
      el('path', Object.assign({ d: 'M ' + (W - 1) + ' 0 A 1 1 0 0 0 ' + W + ' 1' }, line), ln);
      el('path', Object.assign({ d: 'M 0 ' + (L - 1) + ' A 1 1 0 0 1 1 ' + L }, line), ln);
      el('path', Object.assign({ d: 'M ' + W + ' ' + (L - 1) + ' A 1 1 0 0 0 ' + (W - 1) + ' ' + L }, line), ln);
      // 交代ゾーン（ベンチ側 y=0、ハーフウェーラインから3mずつ）
      el('rect', { x: -0.9, y: L - 37, width: 0.9, height: 6, fill: 'rgba(255,235,59,0.45)' }, ln);
      [31, 34, 37].forEach(xx => el('line', Object.assign({ x1: 0, y1: L - xx, x2: -0.7, y2: L - xx }, line), ln));

      if (o.showBench) {
        const bench = (x1, x2, color, label) => {
          const [X, Y1] = S(x2, -5.2);
          el('rect', { x: X - 1.6, y: Y1, width: 1.6, height: x2 - x1, rx: 0.3, fill: color, opacity: 0.55, stroke: '#fff', 'stroke-width': 0.08 }, ln);
          txt(ln, X - 2.2, Y1 + (x2 - x1) / 2, label, 'pl-small', { transform: 'rotate(-90 ' + (X - 2.2) + ' ' + (Y1 + (x2 - x1) / 2) + ')', 'text-anchor': 'middle' });
        };
        bench(22, 30, COLORS.red, '赤ベンチ');
        bench(38, 46, COLORS.blue, '青ベンチ');
      }
      if (o.showFourthTable) {
        const [X, Y] = S(35, -5.6);
        el('rect', { x: X - 1.0, y: Y, width: 1.0, height: 2, rx: 0.2, fill: '#cfd8dc', stroke: '#fff', 'stroke-width': 0.08 }, ln);
      }
    }

    _drawActors() {
      this.actorEls = {};
      const actors = (this.scene.actors || []).slice().sort((a, b) => (a.role === 'ball') - (b.role === 'ball'));
      actors.forEach(a => {
        const g = el('g', { class: 'actor actor-' + a.role, 'data-id': a.id }, this.gActors);
        const hl = el('circle', { r: 2.2, class: 'hl-ring', fill: 'none', stroke: '#ffeb3b', 'stroke-width': 0.28, opacity: 0 }, g);
        if (a.role === 'ball') {
          el('circle', { r: 0.75, fill: '#fff', stroke: '#222', 'stroke-width': 0.16, filter: 'url(#sh)' }, g);
          el('circle', { r: 0.25, fill: '#222' }, g);
        } else if (a.role === 'referee' || a.role === 'assistant' || a.role === 'fourth' || a.role === 'assistantSingle') {
          el('circle', { r: 1.3, fill: COLORS.ref, stroke: COLORS.refRing, 'stroke-width': 0.3, filter: 'url(#sh)' }, g);
          const lab = { referee: '主', assistant: '副', fourth: '4', assistantSingle: '補' }[a.role];
          txt(g, 0, 0.48, lab, 'pl-num pl-ref');
          if (a.role === 'assistant') {
            const fl = el('g', { class: 'flag', opacity: 0 }, g);
            el('line', { x1: 0.8, y1: -0.6, x2: 0.8, y2: -2.8, stroke: '#ddd', 'stroke-width': 0.14 }, fl);
            el('rect', { x: 0.8, y: -2.8, width: 1.3, height: 0.9, fill: '#ffeb3b', stroke: '#e53935', 'stroke-width': 0.12 }, fl);
          }
        } else {
          const gk = a.role === 'goalkeeper';
          const fill = gk ? (a.team === 'blue' ? COLORS.gkBlue : COLORS.gkRed) : COLORS[a.team];
          const ring = gk ? COLORS[a.team] : '#fff';
          el('circle', {
            r: 1.42, fill: fill, stroke: ring, 'stroke-width': gk ? 0.36 : 0.2, filter: 'url(#sh)',
            'stroke-dasharray': a.role === 'substitute' ? '0.5 0.3' : null
          }, g);
          txt(g, 0, 0.52, a.label || '', 'pl-num' + (gk ? ' pl-gk' : ''));
        }
        this.actorEls[a.id] = { g: g, hl: hl, def: a, flag: g.querySelector('.flag') };
      });
      if (this.scene.spotlight && this.actorEls[this.scene.spotlight]) {
        this.actorEls[this.scene.spotlight].hl.setAttribute('opacity', 1);
        this.actorEls[this.scene.spotlight].hl.classList.add('pulse');
      }
    }

    /* ------------------------------------------------ overlays (解説) */
    setOverlays(list) {
      this.gOver.innerHTML = '';
      this.gUnder.innerHTML = '';
      this.overlayDefs = (list || []).map(def => this._makeOverlay(def)).filter(Boolean);
      this.render(this.t);
    }
    _label(parent, str, cls) { return txt(parent, 0, 0, str, 'ov-label ' + (cls || '')); }
    _makeOverlay(d) {
      const self = this;
      const P = ref => Array.isArray(ref) ? ref : self.pos(ref, self.t);
      if (d.type === 'offsideLine') {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const l = el('line', { x1: -0.5, x2: W + 0.5, stroke: '#ffeb3b', 'stroke-width': 0.24, 'stroke-dasharray': '1 0.5' }, g);
        const t = this._label(g, d.label || '', 'ov-yellow');
        t.setAttribute('text-anchor', 'start');
        return { update: tt => { const p = self.pos(d.actor, tt); if (!p) return; const Y = L - p[0]; l.setAttribute('y1', Y); l.setAttribute('y2', Y); t.setAttribute('x', 0.6); t.setAttribute('y', Y - 0.7); } };
      }
      if (d.type === 'distanceCircle') {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const c = el('circle', { r: d.radius, fill: d.muted ? 'none' : 'rgba(255,255,255,0.10)', stroke: d.muted ? 'rgba(255,255,255,0.75)' : '#fff', 'stroke-width': 0.2, 'stroke-dasharray': d.dashed ? '0.8 0.5' : null }, g);
        const t = this._label(g, d.label || '', d.muted ? 'ov-muted' : '');
        t.setAttribute('text-anchor', 'end');
        return { update: tt => { const p = P(d.center === 'ball' ? 'ball' : d.center); if (!p) return; const [X, Y] = S(p[0], p[1]); c.setAttribute('cx', X); c.setAttribute('cy', Y); const ang = d.muted ? 2.55 : 2.2; t.setAttribute('x', X + d.radius * Math.cos(ang) - 0.4); t.setAttribute('y', Y + d.radius * Math.sin(ang) + 1.4); } };
      }
      if (d.type === 'sightLine') {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const l = el('line', { stroke: '#80deea', 'stroke-width': 0.2, 'stroke-dasharray': '0.6 0.4' }, g);
        const t = this._label(g, d.label || '', 'ov-cyan');
        return { update: tt => { const a = self.pos(d.from, tt), b = self.pos(d.to, tt); if (!a || !b) return; const A = S(a[0], a[1]), B = S(b[0], b[1]); l.setAttribute('x1', A[0]); l.setAttribute('y1', A[1]); l.setAttribute('x2', B[0]); l.setAttribute('y2', B[1]); t.setAttribute('x', (A[0] + B[0]) / 2); t.setAttribute('y', (A[1] + B[1]) / 2 + 2.2); } };
      }
      if (d.type === 'zone') {
        const g = el('g', { class: 'ov-item' }, this.gUnder);
        const [X1, Y1] = S(d.x2, d.y1);
        el('rect', { x: X1, y: Y1, width: d.y2 - d.y1, height: d.x2 - d.x1, fill: 'rgba(255,235,59,0.35)', stroke: '#ffeb3b', 'stroke-width': 0.18 }, g);
        const t = this._label(this.gOver, d.label || '', 'ov-yellow');
        t.setAttribute('x', X1 + (d.y2 - d.y1) + 0.8); t.setAttribute('y', Y1 + (d.x2 - d.x1) / 2 + 0.5); t.setAttribute('text-anchor', 'start');
        return { update: () => {} };
      }
      if (d.type === 'marker') {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const [X, Y] = S(d.at[0], d.at[1]);
        el('circle', { cx: X, cy: Y, r: 0.45, fill: '#fff' }, g);
        el('circle', { cx: X, cy: Y, r: 1.2, fill: 'none', stroke: '#69f0ae', 'stroke-width': 0.22 }, g);
        return { update: () => {} };
      }
      if (d.type === 'ruler') {
        const g = el('g', { class: 'ov-item' }, this.gOver);
        const A = S(d.from[0], d.from[1]), B = S(d.to[0], d.to[1]);
        el('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: '#69f0ae', 'stroke-width': 0.2 }, g);
        [A, B].forEach(p => el('line', { x1: p[0] - 0.7, y1: p[1], x2: p[0] + 0.7, y2: p[1], stroke: '#69f0ae', 'stroke-width': 0.2 }, g));
        const t = this._label(g, d.label || '', 'ov-green');
        t.setAttribute('x', A[0] - 1.0); t.setAttribute('y', (A[1] + B[1]) / 2 + 0.5); t.setAttribute('text-anchor', 'end');
        return { update: () => {} };
      }
      return null;
    }

    /* ------------------------------------------------ render */
    render(t) {
      this.t = t;
      Object.keys(this.actorEls).forEach(id => {
        const a = this.actorEls[id];
        const p = this.pos(id, t);
        if (!p) { a.g.setAttribute('display', 'none'); return; }
        a.g.removeAttribute('display');
        const [X, Y] = S(p[0], p[1]);
        a.g.setAttribute('transform', 'translate(' + X.toFixed(3) + ' ' + Y.toFixed(3) + ')');
        if (id !== this.scene.spotlight && !this.pinned.has(id)) a.hl.setAttribute('opacity', 0);
      });
      // events: highlight / bubbles / captions
      this.gBubbles.innerHTML = '';
      let caption = '';
      this.events.forEach(ev => {
        if (ev.t > t + 1e-6) return;
        const age = t - ev.t;
        if (ev.type === 'caption') caption = ev.text;
        else if (ev.type === 'highlight' && age <= (ev.dur || 1.5) && this.actorEls[ev.actor]) this.actorEls[ev.actor].hl.setAttribute('opacity', 1);
        else if (ev.type === 'whistle' && age <= 0.9) this._bubble('REF', 'ピッ！', 'bub-whistle');
        else if (ev.type === 'countdown' && age <= ev.dur + 0.5) {
          const n = Math.max(0, Math.ceil((ev.from || 5) - age));
          this._bubble(ev.by || 'REF', '✋ ' + n, 'bub-count' + (n === 0 ? ' bub-zero' : ''));
        } else if (ev.type === 'flag') {
          const a = this.actorEls[ev.by];
          if (a && a.flag) a.flag.setAttribute('opacity', age <= (ev.dur || 99) ? 1 : 0);
        }
      });
      if (this.opts.onCaption && caption !== this._lastCaption) { this._lastCaption = caption; this.opts.onCaption(caption); }
      this.overlayDefs.forEach(o => o.update(t));
    }
    _bubble(actorId, str, cls) {
      const p = this.pos(actorId, this.t);
      if (!p) return;
      const [X, Y] = S(p[0], p[1]);
      const g = el('g', { class: 'bubble ' + cls, transform: 'translate(' + X + ' ' + (Y - 3.6) + ')' }, this.gBubbles);
      const w = Math.max(4.6, str.length * 1.6);
      el('rect', { x: -w / 2, y: -1.6, width: w, height: 2.9, rx: 0.8 }, g);
      el('path', { d: 'M -0.6 1.3 L 0 2.2 L 0.6 1.3 Z' }, g);
      txt(g, 0, 0.6, str, 'bub-text');
    }

    /* ------------------------------------------------ playback */
    play(o) {
      this.stop();
      const from = o.from || 0, to = o.to != null ? o.to : this.duration, speed = o.speed || 1;
      this.t = from;
      this._lastCaption = null;
      let last = performance.now(), prevT = from;
      const evs = this.events;
      const step = now => {
        const dt = Math.min(0.1, (now - last) / 1000) * speed;
        last = now;
        const nt = Math.min(to, this.t + dt);
        // サウンド等のイベント通知
        if (this.opts.onEvent) {
          evs.forEach(ev => {
            if (ev.t > prevT && ev.t <= nt) this.opts.onEvent(ev);
            if (ev.type === 'countdown') {
              const a = Math.floor(prevT - ev.t), b = Math.floor(nt - ev.t);
              if (b > a && b >= 1 && b <= ev.dur) this.opts.onEvent({ type: 'tick', n: (ev.from || 5) - b });
            }
          });
        }
        prevT = nt;
        this.render(nt);
        if (this.opts.onProgress) this.opts.onProgress((nt - from) / Math.max(0.001, to - from));
        if (nt >= to) { this._raf = null; if (o.onEnd) o.onEnd(); return; }
        this._raf = requestAnimationFrame(step);
      };
      if (from === 0 && this.opts.onEvent) evs.forEach(ev => { if (ev.t === 0) this.opts.onEvent(ev); });
      this.render(from);
      this._raf = requestAnimationFrame(step);
    }
    stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
    get playing() { return !!this._raf; }
    seek(t) { this.stop(); this.render(t); }

    /* ------------------------------------------------ placement */
    _toField(evt) {
      const pt = this.svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      return [L - p.y, p.x];
    }
    enablePlacement(cfg, onChange) {
      this.placeCfg = cfg;
      this.placeVal = null;
      this.svg.classList.add('placing');
      const self = this;
      let dragging = false;
      if (cfg.mode === 'line') {
        // ドラッグ可能アイコンのヒント
        const a = this.actorEls[cfg.actor];
        if (a) {
          a.g.classList.add('draggable');
          this.pinned.add(cfg.actor);
          a.hl.setAttribute('opacity', 1);
          a.hl.classList.add('pulse');
          const hint = el('g', { class: 'drag-hint' }, a.g);
          txt(hint, 0, -2.6, '▲', 'drag-arrow');
          txt(hint, 0, 4.2, '▼', 'drag-arrow');
          this._dragHint = hint;
        }
      } else {
        this.placeMarker = el('g', { class: 'place-marker', display: 'none' }, this.gPlace);
        el('circle', { r: 1.4, fill: 'rgba(255,255,255,0.25)', stroke: '#fff', 'stroke-width': 0.2 }, this.placeMarker);
        el('circle', { r: 0.32, fill: '#fff' }, this.placeMarker);
        txt(this.placeMarker, 0, -2.0, cfg.marker || 'ここ', 'ov-label');
      }
      const apply = p => {
        if (!p) return;
        if (cfg.mode === 'line') {
          const x = Math.max(cfg.min, Math.min(cfg.max, p[0]));
          self.placeVal = [x, cfg.fixedY];
          self.overrides[cfg.actor] = self.placeVal;
          if (self._dragHint) { self._dragHint.remove(); self._dragHint = null; }
        } else {
          const x = Math.max(34, Math.min(L, p[0])), y = Math.max(0, Math.min(W, p[1]));
          self.placeVal = [x, y];
          const [X, Y] = S(x, y);
          self.placeMarker.removeAttribute('display');
          self.placeMarker.setAttribute('transform', 'translate(' + X + ' ' + Y + ')');
        }
        self.render(self.t);
        if (onChange) onChange(self.placeVal);
      };
      this._pd = e => { dragging = true; try { self.svg.setPointerCapture(e.pointerId); } catch (_) {} apply(self._toField(e)); e.preventDefault(); };
      this._pm = e => { if (dragging) { apply(self._toField(e)); e.preventDefault(); } };
      this._pu = () => { dragging = false; };
      this.svg.addEventListener('pointerdown', this._pd);
      this.svg.addEventListener('pointermove', this._pm);
      this.svg.addEventListener('pointerup', this._pu);
      this.svg.addEventListener('pointercancel', this._pu);
      // キーボード操作（アクセシビリティ）
      this.svg.setAttribute('tabindex', '0');
      this._kd = e => {
        const cur = self.placeVal || (cfg.mode === 'line' ? self.pos(cfg.actor, self.t) : [52, 25]);
        const st = e.shiftKey ? 2 : 0.5;
        const map = { ArrowUp: [st, 0], ArrowDown: [-st, 0], ArrowLeft: [0, -st], ArrowRight: [0, st] };
        if (map[e.key]) { apply([cur[0] + map[e.key][0], cur[1] + map[e.key][1]]); e.preventDefault(); }
      };
      this.svg.addEventListener('keydown', this._kd);
    }
    disablePlacement() {
      if (!this.svg) return;
      this.svg.classList.remove('placing');
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown'].forEach((n, i) => {
        const fn = [this._pd, this._pm, this._pu, this._pu, this._kd][i];
        if (fn) this.svg.removeEventListener(n, fn);
      });
      const cfg = this.placeCfg;
      if (cfg && cfg.mode === 'line' && this.actorEls[cfg.actor]) {
        this.actorEls[cfg.actor].g.classList.remove('draggable');
        this.actorEls[cfg.actor].hl.classList.remove('pulse');
        this.pinned.delete(cfg.actor);
      }
    }
    showPlacementResult(user, cfg, ok) {
      const g = el('g', { class: 'place-result' }, this.gPlace);
      const T = S(cfg.target[0], cfg.target[1]);
      if (cfg.mode === 'line') {
        const y1 = L - (cfg.target[0] + cfg.tolerance), h = cfg.tolerance * 2;
        el('rect', { x: 0, y: y1, width: W, height: h, fill: 'rgba(105,240,174,0.16)' }, g);
        el('rect', { x: W - 0.3, y: y1, width: 3, height: h, fill: 'rgba(105,240,174,0.55)', stroke: '#69f0ae', 'stroke-width': 0.18 }, g);
        txt(g, W - 1.0, y1 - 0.5, '正解の範囲', 'ov-label ov-green', { 'text-anchor': 'end' });
        const ghost = el('g', { transform: 'translate(' + T[0] + ' ' + T[1] + ')', opacity: ok ? 0 : 0.9 }, g);
        el('circle', { r: 1.1, fill: 'none', stroke: '#69f0ae', 'stroke-width': 0.3, 'stroke-dasharray': '0.4 0.25' }, ghost);
        txt(ghost, -1.8, 0.4, '正解', 'ov-label ov-green', { 'text-anchor': 'end' });
      } else {
        el('circle', { cx: T[0], cy: T[1], r: cfg.tolerance, fill: 'rgba(105,240,174,0.3)', stroke: '#69f0ae', 'stroke-width': 0.15 }, g);
        el('circle', { cx: T[0], cy: T[1], r: 0.3, fill: '#69f0ae' }, g);
        if (user) {
          const U = S(user[0], user[1]);
          if (!ok) el('line', { x1: U[0], y1: U[1], x2: T[0], y2: T[1], stroke: '#ff8a80', 'stroke-width': 0.16, 'stroke-dasharray': '0.4 0.3' }, g);
          if (this.placeMarker) { this.placeMarker.classList.add(ok ? 'ok' : 'ng'); const lt = this.placeMarker.querySelector('text'); if (lt) lt.textContent = 'あなた'; }
          txt(g, T[0] + cfg.tolerance + 0.6, T[1] + 0.5, '正解', 'ov-label ov-green', { 'text-anchor': 'start' });
        }
      }
    }

    destroy() { this.stop(); this.disablePlacement(); this.c.innerHTML = ''; }
  }

  window.Pitch2D = Pitch2D;
})();
