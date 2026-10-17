/* 8人制 審判クイズ 試作版 — アプリ本体 */
(function () {
  'use strict';
  const D = window.QUIZ_DATA;
  const QMAP = {};
  D.QUESTIONS.forEach(q => { QMAP[q.id] = q; });
  const KEY = 'ref8quiz.v1';

  /* ================================================= 状態 */
  const defaults = () => ({ level: null, order: [], idx: 0, results: {}, ratings: {}, notes: '', settings: { sound: true, haptics: true }, round: 'main', finished: false });
  let S = (function () {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.settings) return Object.assign(defaults(), s); } catch (e) { /* noop */ }
    return defaults();
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* noop */ } }

  const LEVELS = {
    beginner: { label: '入門', who: '保護者審判・はじめての方', replays: Infinity, slow: true, hints: true,
      points: ['何度でも見直せる・スロー再生あり', 'ヒントあり', '用語はタップで説明'] },
    grade4: { label: '4級', who: '4級審判員・ステップアップしたい方', replays: 1, slow: false, hints: false,
      points: ['試合に近づけて、見直しは1回まで', '懲戒（カード）まで判断', '補助審判の問題も追加'] }
  };
  const lv = () => LEVELS[S.level || 'beginner'];
  const stepsFor = q => q.steps.filter(s => !s.levels || s.levels.indexOf(S.level || 'beginner') >= 0);

  /* ================================================= DOM ユーティリティ */
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => append(e, x)); return; }
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  // {{用語}} をタップ可能な用語ボタンに
  function rich(str) {
    const frag = document.createDocumentFragment();
    String(str || '').split(/(\{\{.+?\}\})/).forEach(part => {
      const m = part.match(/^\{\{(.+)\}\}$/);
      if (m) frag.appendChild(h('button', { type: 'button', class: 'term', onClick: () => showGloss(m[1]) }, m[1]));
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }
  const app = document.getElementById('app');

  /* ---------- 用語ポップアップ */
  let glossEl = null;
  function showGloss(term) {
    hideGloss();
    const def = D.GLOSSARY[term] || '';
    glossEl = h('div', { class: 'gloss', role: 'dialog', 'aria-label': term + 'の説明' },
      h('div', { class: 'gloss-head' }, h('strong', { text: term }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', onClick: hideGloss }, '×')),
      h('p', { text: def }));
    document.body.appendChild(glossEl);
    requestAnimationFrame(() => glossEl && glossEl.classList.add('show'));
    setTimeout(() => document.addEventListener('pointerdown', outsideGloss), 0);
  }
  function outsideGloss(e) { if (glossEl && !glossEl.contains(e.target)) hideGloss(); }
  function hideGloss() { document.removeEventListener('pointerdown', outsideGloss); if (glossEl) { glossEl.remove(); glossEl = null; } }

  /* ---------- トースト・確認ダイアログ */
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }
  function confirmBox(msg, ok, cancel) {
    return new Promise(resolve => {
      const close = v => { wrap.remove(); resolve(v); };
      const okBtn = h('button', { type: 'button', class: 'btn primary', onClick: () => close(true) }, ok);
      const wrap = h('div', { class: 'modal-wrap', onClick: e => { if (e.target === wrap) close(false); } },
        h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true' },
          h('p', { text: msg }),
          h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onClick: () => close(false) }, cancel), okBtn)));
      document.body.appendChild(wrap);
      okBtn.focus();
    });
  }

  /* ================================================= 音・振動 */
  const Sound = {
    ctx: null,
    unlock() {
      if (!S.settings.sound) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null; }
    },
    _ok() { return S.settings.sound && this.ctx; },
    tone(freq, dur, type, gain, at) {
      const c = this.ctx, t = c.currentTime + (at || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.06, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    whistle() {
      if (!this._ok()) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.frequency.setValueAtTime(2900, t); lfo.frequency.value = 30; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      g.gain.setValueAtTime(0.09, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g); g.connect(c.destination);
      o.start(t); lfo.start(t); o.stop(t + 0.45); lfo.stop(t + 0.45);
    },
    tick() { if (this._ok()) this.tone(1100, 0.07, 'sine', 0.04); },
    good() { if (this._ok()) { this.tone(660, 0.12, 'triangle', 0.07); this.tone(990, 0.2, 'triangle', 0.07, 0.1); } },
    bad() { if (this._ok()) this.tone(200, 0.22, 'square', 0.03); }
  };
  function buzz(p) { if (S.settings.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* noop */ } }

  /* ================================================= 画面の後片付け */
  let current = null; // { destroy() }
  function teardown() {
    hideGloss();
    if (current && current.destroy) current.destroy();
    current = null;
    app.innerHTML = '';
    scrollTopNow();
  }
  function scrollTopNow() { try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }

  /* ================================================= ホーム */
  function pitchLogo() {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 64 84'); s.setAttribute('class', 'logo'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="2" y="2" width="60" height="80" rx="6" fill="#2f7d33"/>' +
      '<g fill="none" stroke="#fff" stroke-width="1.6" opacity=".9"><rect x="7" y="7" width="50" height="70"/><line x1="7" y1="42" x2="57" y2="42"/><circle cx="32" cy="42" r="7"/><rect x="18" y="7" width="28" height="12"/><rect x="18" y="65" width="28" height="12"/></g>' +
      '<circle cx="24" cy="30" r="3.4" fill="#e53935" stroke="#fff"/><circle cx="40" cy="24" r="3.4" fill="#1e63d6" stroke="#fff"/><circle cx="31" cy="34" r="1.8" fill="#fff" stroke="#222" stroke-width=".6"/>' +
      '<circle cx="50" cy="36" r="3" fill="#111" stroke="#ffeb3b"/>';
    return s;
  }
  function toggleRow(label, key) {
    const input = h('input', { type: 'checkbox', role: 'switch' });
    input.checked = !!S.settings[key];
    input.addEventListener('change', () => { S.settings[key] = input.checked; save(); if (key === 'sound' && input.checked) { Sound.unlock(); Sound.tick(); } if (key === 'haptics' && input.checked) buzz(20); });
    return h('label', { class: 'toggle' }, h('span', { text: label }), input, h('span', { class: 'sw', 'aria-hidden': 'true' }));
  }

  function renderHome() {
    teardown();
    let sel = S.level || 'beginner'; // はじめての方が迷わないよう「入門」を初期選択
    const inProgress = S.order.length > 0 && !S.finished && (S.idx > 0 || Object.keys(S.results).length > 0);
    const startBtn = h('button', { type: 'button', class: 'btn primary big', disabled: !sel, onClick: () => { Sound.unlock(); startRound(sel); } }, '↑ レベルを選んでください');
    const cards = Object.keys(LEVELS).map(k => {
      const L = LEVELS[k];
      const b = h('button', { type: 'button', class: 'level-card' + (sel === k ? ' on' : ''), role: 'radio', 'aria-checked': sel === k ? 'true' : 'false', 'data-k': k,
        onClick: () => {
          sel = k;
          cards.forEach(c => { const on = c.getAttribute('data-k') === k; c.classList.toggle('on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
          startBtn.disabled = false;
          startBtn.textContent = L.label + 'ではじめる';
        } },
        h('span', { class: 'lv-badge lv-' + k, text: L.label }),
        h('span', { class: 'lv-who', text: L.who }),
        h('ul', { class: 'lv-points' }, L.points.map(p => h('li', { text: p }))));
      return b;
    });
    if (sel) startBtn.textContent = LEVELS[sel].label + 'ではじめる';

    const screen = h('div', { class: 'screen home' },
      h('div', { class: 'hero' }, pitchLogo(),
        h('div', null,
          h('h1', null, '8人制', h('br'), '審判トレーニング'),
          h('p', { class: 'lead', text: '動きを見て、その場で判定。保護者審判と4級審判のための試作版クイズです。' }))),
      h('div', { class: 'chips' },
        h('span', { class: 'chip', text: '競技規則 ' + D.RULE_VERSION + ' 準拠' }),
        h('span', { class: 'chip', text: '全' + D.QUESTIONS.length + '問・約8分' }),
        h('span', { class: 'chip', text: '3D問題あり' })),
      inProgress ? h('div', { class: 'card resume' },
        h('div', null, h('strong', { text: '続きから' }), h('span', { class: 'muted', text: '　' + LEVELS[S.level].label + '・' + (S.idx + 1) + ' / ' + S.order.length + '問目' })),
        h('button', { type: 'button', class: 'btn primary', onClick: () => { Sound.unlock(); renderQuestion(); } }, '続ける')) : null,
      (S.finished && S.order.length) ? h('div', { class: 'card resume' },
        h('div', null, h('strong', { text: '前回の結果' }), h('span', { class: 'muted', text: '　' + LEVELS[S.level].label + '・' + Object.values(S.results).filter(r => r && r.ok).length + ' / ' + S.order.length + '問正解' })),
        h('button', { type: 'button', class: 'btn ghost', onClick: () => renderResult() }, '見る')) : null,
      h('h2', { class: 'sec', text: 'レベルを選ぶ' }),
      h('div', { class: 'levels', role: 'radiogroup', 'aria-label': 'レベル' }, cards),
      h('div', { class: 'howto' },
        h('h2', { class: 'sec', text: '遊び方' }),
        h('ol', null,
          h('li', null, h('b', { text: 'プレーを見る' }), h('span', { text: '先に問いを読んでから再生。判定の瞬間で止まります' })),
          h('li', null, h('b', { text: '判定する' }), h('span', { text: '選択肢を選ぶ、または審判や位置をドラッグして「判定する」' })),
          h('li', null, h('b', { text: '解説リプレイ' }), h('span', { text: 'ラインや距離を重ねて、もう一度再生します' })))),
      h('div', { class: 'card settings' },
        h('h2', { class: 'sec', text: '設定' }),
        toggleRow('効果音（笛など）', 'sound'),
        toggleRow('振動（対応端末のみ）', 'haptics')),
      h('div', { class: 'notes' },
        h('p', null, h('b', { text: '試作版について：' }), '問題と解説は監修前です。実際の判定はJFAの競技規則に従ってください。'),
        h('p', null, h('b', { text: '2026/27改正：' }), '地域・都道府県の大会では、主催者が適用開始日を決めます（遅くとも2027年4月1日）。🆕の問題は大会要項で確認しましょう。'),
        h('p', { class: 'src' }, '出典：', Object.keys(D.SRC).map((k, i) => [i ? '／' : '', h('a', { href: D.SRC[k].url, target: '_blank', rel: 'noopener', text: D.SRC[k].label })]))),
      h('div', { class: 'actionbar' }, startBtn));
    app.appendChild(screen);
  }

  function startRound(level, ids, round) {
    S.level = level;
    S.order = ids || D.QUESTIONS.filter(q => q.levels.indexOf(level) >= 0).map(q => q.id);
    S.idx = 0;
    if (round !== 'retry') S.results = {};
    S.round = round || 'main';
    S.finished = false;
    save();
    renderQuestion();
  }

  /* ================================================= 問題画面 */
  function renderQuestion() {
    if (S.idx >= S.order.length) { S.finished = true; save(); renderResult(); return; }
    mountQuestion(QMAP[S.order[S.idx]], {});
  }

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  function legendEl(is3d) {
    const dot = (cls, label) => h('span', { class: 'lg' }, h('i', { class: 'dot ' + cls }), label);
    if (is3d) return h('div', { class: 'legend', hidden: true },
      dot('d-red', '赤10番（攻撃）'), dot('d-blue', '青4番（守備）'), dot('d-gk', 'GK'), dot('d-ref', '黒＝審判'), dot('d-sole', '黄色＝スパイクの裏'));
    return h('div', { class: 'legend', hidden: true },
      dot('d-red', '赤チーム（↑へ攻撃）'), dot('d-blue', '青チーム'), dot('d-gk', '青GK'),
      dot('d-ref', '主＝主審 / 副＝副審 / 4＝第4の審判員'), dot('d-ball', 'ボール'), dot('d-sub', '点線＝交代要員'));
  }

  function mountQuestion(q, opts) {
    teardown();
    const review = !!opts.review;
    const L = lv();
    const steps = stepsFor(q);
    const is3d = q.kind === '3d';
    const scene = q.scene || {};
    const pauseAt = is3d ? q.scene3d.pauseAt : scene.pauseAt;
    const endAt = is3d ? q.scene3d.endAt : (scene.endAt || scene.pauseAt);
    const hasAnim = is3d || (pauseAt > 0 && !scene.static);
    const st = { phase: 'intro', step: 0, sel: null, res: [], views: 0, speed: 1, place: null, hint: false, done: false };
    let engine = null, destroyed = false;

    /* ---------- DOM */
    const stage = h('div', { class: 'stage' + (is3d ? ' stage-3d' : '') });
    const caption = h('div', { class: 'stage-caption', 'aria-live': 'polite' });
    const playOverlay = h('button', { type: 'button', class: 'stage-play', 'aria-label': 'プレーを再生する', onClick: () => watch() },
      h('span', { class: 'tri', 'aria-hidden': 'true' }), h('span', { class: 'lbl', text: 'プレーを見る' }));
    const freezeBadge = h('div', { class: 'stage-badge', hidden: true, text: '⏸ 判定の瞬間' });
    const progBar = h('i');
    const hasRed = !is3d && (scene.actors || []).some(a => a.team === 'red' && a.role !== 'substitute');
    const dirChip = hasRed ? h('div', { class: 'dir-chip', 'aria-hidden': 'true', text: '赤の攻撃 ↑' }) : null;
    const camTabs = is3d ? h('div', { class: 'cam-tabs', role: 'tablist', 'aria-label': '視点' }) : null;
    const hasCaptions = is3d ? (q.scene3d.captions || []).length > 0 : (scene.timeline || []).some(k => (k.events || []).some(e => e.type === 'caption'));
    if (!hasCaptions) caption.classList.add('none');
    const stageBox = h('div', { class: 'stage-box' }, stage, dirChip, freezeBadge, playOverlay);
    const stageWrap = h('div', { class: 'stage-wrap' }, stageBox, caption, h('div', { class: 'stage-progress' }, progBar));
    const legend = legendEl(is3d);

    const btnReplay = h('button', { type: 'button', class: 'tool', onClick: () => replay() });
    const btnSlow = h('button', { type: 'button', class: 'tool', 'aria-pressed': 'false', onClick: () => toggleSpeed() });
    const btnLegend = h('button', { type: 'button', class: 'tool', 'aria-expanded': 'false', onClick: () => {
      legend.hidden = !legend.hidden; btnLegend.setAttribute('aria-expanded', legend.hidden ? 'false' : 'true');
    } }, '凡例');
    const btnContact = is3d ? h('button', { type: 'button', class: 'tool', hidden: true, onClick: () => { if (engine) { engine.seek(engine.contactAt); setProg(engine.contactAt / endAt); } } }, '⏱ 接触の瞬間') : null;
    const tools = h('div', { class: 'stage-tools' }, btnReplay, btnSlow, btnContact, btnLegend);

    const panel = h('section', { class: 'panel' });
    const action = h('button', { type: 'button', class: 'btn primary big' });

    // ヘッダー（進捗）
    const segs = S.order.map((id, i) => {
      const r = S.results[id];
      let cls = 'seg';
      if (!review && i === S.idx) cls += ' now';
      else if (r && r.skipped) cls += ' skip';
      else if (r) cls += r.ok ? ' ok' : ' ng';
      return h('i', { class: cls });
    });
    const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': '効果音の切り替え', 'aria-pressed': S.settings.sound ? 'true' : 'false',
      onClick: () => { S.settings.sound = !S.settings.sound; save(); soundBtn.textContent = S.settings.sound ? '🔊' : '🔇'; soundBtn.setAttribute('aria-pressed', S.settings.sound ? 'true' : 'false'); if (S.settings.sound) Sound.unlock(); } },
      S.settings.sound ? '🔊' : '🔇');
    const header = h('header', { class: 'qbar' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': review ? '結果に戻る' : '中断する', onClick: () => quit() }, '×'),
      h('div', { class: 'segs', 'aria-hidden': 'true' }, segs),
      h('span', { class: 'count', text: review ? '復習' : (S.idx + 1) + ' / ' + S.order.length }),
      soundBtn);

    const badges = [];
    if (q.badges.indexOf('new2026') >= 0) badges.push(h('span', { class: 'chip chip-new', text: '🆕 2026/27改正' }));
    if (q.badges.indexOf('provisional') >= 0) badges.push(h('span', { class: 'chip chip-warn', text: '一部 監修前' }));
    const title = h('h2', { class: 'qtitle', tabindex: '-1', text: q.title });
    const main = h('main', { class: 'qmain' },
      h('div', { class: 'qmeta' }, h('span', { class: 'chip chip-cat', text: D.CATEGORIES[q.category] }), badges, h('span', { class: 'chip chip-lv', text: L.label })),
      title, stageWrap, camTabs, tools, legend, panel);
    const screen = h('div', { class: 'screen quiz' + (is3d ? ' is3d' : '') }, header, main, h('div', { class: 'actionbar' }, action));
    app.appendChild(screen);
    scrollTopNow();
    setTimeout(() => title.focus({ preventScroll: true }), 50);

    /* ---------- エンジン */
    function setCaption(text) { caption.textContent = text || ''; caption.classList.toggle('show', !!text); }
    function setProg(k) { progBar.style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%'; }
    function onEv(ev) { if (ev.type === 'whistle') Sound.whistle(); else if (ev.type === 'tick') Sound.tick(); }

    function ready() {
      if (destroyed) return;
      if (hasAnim) setPhase('intro'); else setPhase('answering');
    }
    if (is3d) {
      stage.appendChild(h('div', { class: 'loader' }, h('span', { class: 'spin' }), '3Dを読み込み中…'));
      playOverlay.hidden = true;
      const caps = q.scene3d.captions || [];
      window.Scene3D.create(stage, q.scene3d, {
        onProgress: k => setProg(k),
        onTime: t => { let c = ''; caps.forEach(x => { if (x.t <= t + 1e-6) c = x.text; }); if (c !== caption.textContent) setCaption(c); }
      }).then(e => {
        if (destroyed) { e.destroy(); return; }
        engine = e; buildCamTabs(); ready();
      }).catch(err => {
        console.error(err);
        stage.innerHTML = '';
        if (camTabs) camTabs.hidden = true;
        const noGL = /WebGL/i.test(String((err && err.message) || err));
        stage.appendChild(h('div', { class: 'loader fail' },
          h('p', { text: noGL ? 'この端末・ブラウザでは3D表示が使えないようです。別のブラウザ（Chrome / Safari の最新版）でお試しください。' : '3Dを読み込めませんでした。通信環境を確認して、もう一度お試しください。' }),
          h('small', { class: 'err-detail', text: '詳細: ' + String((err && err.message) || err).slice(0, 160) }),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn ghost', onClick: () => mountQuestion(q, opts) }, '再試行'),
            review ? null : h('button', { type: 'button', class: 'btn ghost', onClick: () => skip() }, 'この問題をとばす'))));
        panel.innerHTML = '';
        action.hidden = true;
      });
    } else {
      engine = new window.Pitch2D(stage, scene, { onCaption: setCaption, onEvent: onEv, onProgress: setProg });
      ready();
    }

    function buildCamTabs() {
      camTabs.innerHTML = '';
      window.Scene3D.CAMERAS.forEach(c => {
        const b = h('button', { type: 'button', role: 'tab', class: 'cam' + (c.id === 'referee' ? ' on' : ''), 'data-id': c.id, 'aria-selected': c.id === 'referee' ? 'true' : 'false',
          onClick: () => {
            if (b.classList.contains('locked')) { toast('解答したあとに、ほかの視点で見られます'); return; }
            camTabs.querySelectorAll('.cam').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
            engine.setCamera(c.id, true);
          } }, c.id !== 'referee' ? h('span', { class: 'lock', 'aria-hidden': 'true', text: '🔒' }) : null, c.label);
        if (c.id !== 'referee') b.classList.add('locked');
        camTabs.appendChild(b);
      });
    }
    function unlockCams(to) {
      if (!camTabs) return;
      camTabs.querySelectorAll('.cam').forEach(b => { b.classList.remove('locked'); const l = b.querySelector('.lock'); if (l) l.remove(); });
      const t = camTabs.querySelector('[data-id="' + to + '"]');
      if (t) t.click();
    }

    /* ---------- 再生 */
    const canReplayBeforeAnswer = () => L.replays === Infinity || st.views <= L.replays;
    function watch() {
      if (!engine) return;
      Sound.unlock();
      st.views++;
      setPhase(st.phase === 'intro' ? 'watching' : st.phase, true);
      playOverlay.hidden = true;
      freezeBadge.hidden = true;
      const wasAnswering = st.phase === 'answering';
      if (!wasAnswering) setPhase('watching');
      engine.play({ from: 0, to: pauseAt, speed: st.speed, onEnd: () => {
        freezeBadge.hidden = false;
        if (st.phase === 'watching') setPhase('answering'); else updateTools();
      } });
      updateTools();
    }
    function replay() {
      if (!engine) return;
      if (st.phase === 'feedback') { playExplain(); return; }
      if (!canReplayBeforeAnswer()) return;
      watch();
    }
    function playExplain() {
      if (!engine) return;
      freezeBadge.hidden = true;
      if (is3d) engine.play({ from: 0, to: endAt, speed: st.speed });
      else if (hasAnim) engine.play({ from: 0, to: endAt, speed: st.speed, onEnd: () => updateTools() });
      updateTools();
    }
    function toggleSpeed() {
      const seq = is3d ? [1, 0.5, 0.25] : [1, 0.5];
      st.speed = seq[(seq.indexOf(st.speed) + 1) % seq.length];
      btnSlow.setAttribute('aria-pressed', st.speed < 1 ? 'true' : 'false');
      updateTools();
      toast(st.speed === 1 ? '通常の速さ' : st.speed + '倍のスロー再生');
    }
    function updateTools() {
      const fb = st.phase === 'feedback';
      tools.hidden = !hasAnim && !fb;
      btnReplay.hidden = !hasAnim;
      if (fb) { btnReplay.disabled = false; btnReplay.textContent = '↺ 解説リプレイ'; }
      else {
        const left = L.replays === Infinity ? Infinity : L.replays - (st.views - 1);
        btnReplay.disabled = st.phase === 'intro' || st.phase === 'watching' || left <= 0;
        btnReplay.textContent = left === Infinity ? '↺ もう一度見る' : (left > 0 ? '↺ もう一度見る（残り' + left + '回）' : '見直しは1回まで');
      }
      const slowOk = fb || L.slow;
      btnSlow.hidden = !hasAnim || !slowOk;
      btnSlow.textContent = '🐢 ' + (st.speed === 1 ? 'スロー' : st.speed + '倍');
      if (btnContact) btnContact.hidden = !fb;
    }

    /* ---------- フェーズ */
    function setPhase(p) {
      st.phase = p;
      if (p === 'intro') {
        playOverlay.hidden = false;
        renderPrompt(false);
        setAction('▶ プレーを見る', false, () => watch());
      } else if (p === 'watching') {
        if (!panel.querySelector('.prompt')) renderPrompt(false);
        setAction('再生中…', true);
      } else if (p === 'answering') {
        playOverlay.hidden = true;
        renderPrompt(true);
        setAction('判定する', true, () => submit());
        refreshSubmit();
      }
      updateTools();
    }
    function setAction(label, disabled, fn) {
      action.hidden = false;
      action.textContent = label;
      action.disabled = !!disabled;
      action.onclick = fn || null;
    }
    function refreshSubmit() {
      const s = steps[st.step];
      const ok = s.type === 'placement' ? !!st.place : !!st.sel;
      action.disabled = !ok;
      action.textContent = ok ? '判定する' : (s.type === 'placement' ? '位置を決めてください' : '選択肢を選んでください');
    }

    /* ---------- 問い・選択肢 */
    function stepHistory() {
      if (st.step === 0) return null;
      return h('ol', { class: 'step-hist' }, st.res.map((r, i) => {
        const s = steps[i];
        const txt = s.type === 'placement' ? '位置' : (s.choices.find(c => c.id === r.pick) || {}).text;
        return h('li', { class: r.ok ? 'ok' : 'ng' }, h('span', { class: 'mk', text: r.ok ? '✓' : '✗' }), h('span', { text: txt || '' }));
      }));
    }
    function renderPrompt(showChoices) {
      const s = steps[st.step];
      panel.innerHTML = '';
      const parts = [];
      if (steps.length > 1) parts.push(h('div', { class: 'step-no', text: '質問 ' + (st.step + 1) + ' / ' + steps.length }));
      parts.push(stepHistory());
      parts.push(h('p', { class: 'prompt' }, rich(s.question)));
      if (L.hints && q.hint && st.step === 0 && !review) {
        const hintBox = h('p', { class: 'hint', hidden: !st.hint, text: '💡 ' + q.hint });
        const hintBtn = h('button', { type: 'button', class: 'link-btn', hidden: st.hint, onClick: () => { st.hint = true; hintBox.hidden = false; hintBtn.hidden = true; } }, '💡 ヒントを見る');
        parts.push(hintBtn, hintBox);
      }
      if (!showChoices) {
        parts.push(h('p', { class: 'muted wait', text: hasAnim ? '問いを読んだら、プレーを再生しましょう。判定の瞬間で止まり、選択肢が出ます。' : '' }));
      } else if (s.type === 'choice') {
        const list = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': '選択肢' });
        s.choices.forEach((c, i) => {
          const b = h('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': 'false', 'data-id': c.id,
            onClick: () => {
              if (st.done) return;
              st.sel = c.id;
              list.querySelectorAll('.choice').forEach(x => { const on = x === b; x.classList.toggle('sel', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
              buzz(8);
              refreshSubmit();
            } },
            h('span', { class: 'letter', text: LETTERS[i] }), h('span', { class: 'ctext' }, rich(c.text)));
          list.appendChild(b);
        });
        parts.push(list);
        setTimeout(() => { if (!destroyed && list.isConnected) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
      } else if (s.type === 'placement') {
        const pc = s.placement;
        parts.push(h('p', { class: 'place-help', text: pc.mode === 'line' ? '↕ 副審をタッチラインに沿って上下にドラッグ。ピッチをタップしても動かせます。' : '👆 ピッチをタップして置き、ドラッグで微調整できます。' }));
        engine.enablePlacement(pc, p => { st.place = p; refreshSubmit(); });
      }
      append(panel, parts);
    }

    /* ---------- 判定 */
    function judgePlacement(pc, p) {
      const dist = pc.mode === 'line' ? Math.abs(p[0] - pc.target[0]) : Math.hypot(p[0] - pc.target[0], p[1] - pc.target[1]);
      const ok = dist <= pc.tolerance;
      let note = '';
      if (!ok) (pc.zones || []).some(z => {
        const d = z.at ? Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) : Math.abs(p[0] - z.lineX);
        if (d <= z.r) { note = z.text; return true; }
        return false;
      });
      return { ok: ok, note: note, desc: pc.describe ? pc.describe(p) : '' };
    }
    function submit() {
      if (st.done) return;
      const s = steps[st.step];
      let r;
      if (s.type === 'choice') {
        r = { ok: st.sel === s.answer, pick: st.sel };
        panel.querySelectorAll('.choice').forEach(b => {
          const id = b.getAttribute('data-id');
          b.disabled = true;
          const cc = s.choices.find(x => x.id === id);
          if (cc && cc.note) b.appendChild(h('span', { class: 'cnote', text: cc.note }));
          if (id === s.answer) { b.classList.add('is-correct'); b.appendChild(h('span', { class: 'mark', text: '✓ 正解' })); }
          else if (id === st.sel) {
            b.classList.add('is-wrong');
            b.appendChild(h('span', { class: 'mark', text: '✗' }));
            const c = s.choices.find(x => x.id === id);
            if (c && c.feedback) b.after(h('p', { class: 'choice-fb' }, rich(c.feedback)));
          } else b.classList.add('is-dim');
        });
      } else {
        const j = judgePlacement(s.placement, st.place);
        r = { ok: j.ok, pick: st.place };
        engine.disablePlacement();
        engine.showPlacementResult(st.place, s.placement, j.ok);
        const ph = panel.querySelector('.place-help'); if (ph) ph.remove();
        panel.appendChild(h('div', { class: 'place-fb ' + (j.ok ? 'ok' : 'ng') },
          h('p', { class: 'desc', text: j.desc }), j.note ? h('p', { text: j.note }) : null));
      }
      st.res.push(r);
      panel.querySelectorAll('.link-btn, .hint').forEach(x => x.remove());
      if (r.ok) { Sound.good(); buzz(18); } else { Sound.bad(); buzz([30, 50, 30]); }
      panel.appendChild(h('p', { class: 'verdict-mini ' + (r.ok ? 'ok' : 'ng'), role: 'status', text: r.ok ? '✓ 正解！' : '✗ ざんねん' }));
      if (st.step < steps.length - 1) {
        st.phase = 'stepResult';
        setAction('次の質問へ →', false, () => { st.step++; st.sel = null; setPhase('answering'); panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
      } else {
        st.done = true;
        enterFeedback();
      }
    }

    /* ---------- 解説 */
    function enterFeedback() {
      st.phase = 'feedback';
      const nOk = st.res.filter(r => r.ok).length;
      const okAll = nOk === steps.length;
      if (!review) {
        S.results[q.id] = { ok: okAll, n: nOk, total: steps.length, hint: st.hint, views: st.views, at: Date.now() };
        save();
        const seg = segs[S.idx]; if (seg) { seg.classList.remove('now'); seg.classList.add(okAll ? 'ok' : 'ng'); }
      }
      const vText = okAll ? '正解！' : (nOk > 0 ? 'おしい！ ' + nOk + ' / ' + steps.length + ' 問正解' : 'ざんねん');
      const verdict = h('div', { class: 'verdict ' + (okAll ? 'ok' : (nOk ? 'part' : 'ng')) },
        h('span', { class: 'v-icon', 'aria-hidden': 'true', text: okAll ? '✓' : (nOk ? '△' : '✗') }), h('strong', { text: vText }));
      const ex = q.explain;
      const notices = [];
      if (q.badges.indexOf('new2026') >= 0) notices.push(h('p', { class: 'notice new' }, h('b', { text: '🆕 2026/27改正。' }), '地域・都道府県の大会では、まだ2025/26版を使っている場合があります（遅くとも2027年4月1日までに適用）。大会要項で確認しましょう。'));
      if (q.badges.indexOf('provisional') >= 0) notices.push(h('p', { class: 'notice warn' }, h('b', { text: '⚠️ 監修前の暫定解答。' }), '懲戒（カード）の判断は、監修者の確認後に確定します。'));
      const rate = (k, label) => h('button', { type: 'button', class: 'rate' + (S.ratings[q.id] === k ? ' on' : ''), onClick: e => {
        S.ratings[q.id] = k; save();
        e.currentTarget.parentNode.querySelectorAll('.rate').forEach(x => x.classList.toggle('on', x === e.currentTarget));
        toast('ありがとうございます');
      } }, label);
      const card = h('div', { class: 'explain' },
        verdict,
        h('p', { class: 'ex-sum' }, rich(ex.summary)),
        is3d ? h('p', { class: 'ex-tip', text: '👆 上の視点ボタンで「副審の位置」「真横」に切り替えて、見え方の違いを確かめましょう。' }) : null,
        ex.detail ? h('details', { class: 'ex-detail', open: true }, h('summary', { text: 'くわしい解説' }), h('p', null, rich(ex.detail))) : null,
        notices,
        h('div', { class: 'refs' }, h('span', { class: 'muted', text: '根拠' }),
          q.refs.map(r => h('a', { class: 'ref', href: D.SRC[r.src].url, target: '_blank', rel: 'noopener' }, '📖 ' + r.article, h('small', { text: D.SRC[r.src].label })))),
        review ? null : h('div', { class: 'rating' }, h('span', { class: 'muted', text: 'この問題は、わかりやすかった？' }),
          h('div', { class: 'rate-row' }, rate('good', '👍 わかりやすい'), rate('hard', '🤔 わかりにくい'))));
      panel.appendChild(card);

      // ステージ：解説リプレイ
      stageWrap.classList.add('sticky');
      if (is3d) {
        engine.setAnalysis(true);
        unlockCams('side');
        st.speed = 0.5;
        btnSlow.setAttribute('aria-pressed', 'true');
        playExplain();
      } else {
        engine.setOverlays(ex.overlays || []);
        if (hasAnim) playExplain(); else engine.seek(0);
      }
      const last = S.idx >= S.order.length - 1;
      setAction(review ? '結果に戻る' : (last ? '結果を見る' : '次の問題へ →'), false, () => {
        if (review) { renderResult(); return; }
        S.idx++; save(); renderQuestion();
      });
      updateTools();
      requestAnimationFrame(() => {
        const head = document.querySelector('.qbar');
        const off = (head ? head.offsetHeight : 0) + (stageWrap.classList.contains('sticky') && getComputedStyle(stageWrap).position === 'sticky' ? stageWrap.offsetHeight : 0) + 8;
        const y = verdict.getBoundingClientRect().top + window.scrollY - off;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      });
      preload3d();
    }

    function skip() {
      S.results[q.id] = { skipped: true, at: Date.now() };
      S.idx++; save(); renderQuestion();
    }
    async function quit() {
      if (review) { renderResult(); return; }
      if (await confirmBox('中断してホームに戻りますか？ 進み具合は保存されます。', 'ホームへ', '続ける')) renderHome();
    }

    current = { destroy: () => { destroyed = true; if (engine) engine.destroy(); } };
    preload3d();
  }

  function preload3d() {
    if (!window.Scene3D) return;
    for (let i = S.idx; i < Math.min(S.order.length, S.idx + 3); i++) {
      if (QMAP[S.order[i]].kind === '3d') { window.Scene3D.preload().catch(() => {}); return; }
    }
  }

  /* ================================================= 結果画面 */
  function scoreRing(score, total) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 120 120'); s.setAttribute('class', 'ring'); s.setAttribute('aria-hidden', 'true');
    const r = 52, c = 2 * Math.PI * r, k = total ? score / total : 0;
    s.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e3e8e3" stroke-width="12"/>' +
      '<circle class="ring-val" cx="60" cy="60" r="' + r + '" fill="none" stroke="#2e7d32" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" transform="rotate(-90 60 60)" data-off="' + (c * (1 - k)) + '"/>';
    return s;
  }

  function renderResult() {
    teardown();
    const items = S.order.map(id => ({ q: QMAP[id], r: S.results[id] }));
    const counted = items.filter(i => i.r && !i.r.skipped);
    const score = counted.filter(i => i.r.ok).length, total = counted.length;
    const ratio = total ? score / total : 0;
    const msg = ratio >= 0.9 ? 'すばらしい！ 試合でも自信を持って判定できそうです。'
      : ratio >= 0.6 ? 'よくできました。間違えた問題の解説リプレイを、もう一度見ておきましょう。'
        : 'まずは解説リプレイで、動きと判定の関係をつかみましょう。何度でも挑戦できます。';
    const wrong = items.filter(i => i.r && !i.r.skipped && !i.r.ok).map(i => i.q.id);

    // カテゴリー別
    const cats = {};
    counted.forEach(i => { const c = cats[i.q.category] = cats[i.q.category] || { ok: 0, n: 0 }; c.n++; if (i.r.ok) c.ok++; });
    const catRows = Object.keys(cats).map(k => h('div', { class: 'cat-row' },
      h('span', { class: 'cat-name', text: D.CATEGORIES[k] }),
      h('span', { class: 'bar' }, h('i', { style: 'width:' + Math.round(cats[k].ok / cats[k].n * 100) + '%' })),
      h('span', { class: 'cat-num', text: cats[k].ok + '/' + cats[k].n })));

    const list = h('ul', { class: 'res-list' }, items.map(i => {
      const r = i.r;
      const mk = !r ? '–' : r.skipped ? '–' : r.ok ? '✓' : (r.n ? '△' : '✗');
      const cls = !r || r.skipped ? 'skip' : r.ok ? 'ok' : 'ng';
      return h('li', { class: cls },
        h('span', { class: 'mk', text: mk }),
        h('span', { class: 'rt' }, h('b', { text: i.q.title }), h('small', { text: D.CATEGORIES[i.q.category] + (r && r.total > 1 ? '・' + r.n + '/' + r.total : '') + (r && r.hint ? '・ヒント使用' : '') })),
        h('button', { type: 'button', class: 'btn ghost sm', onClick: () => mountQuestion(i.q, { review: true }) }, 'もう一度'));
    }));

    const notes = h('textarea', { class: 'notes-input', rows: '3', placeholder: '気づいたこと（例：○問目の動きが速すぎた、言葉が難しかった など）' });
    notes.value = S.notes || '';
    notes.addEventListener('input', () => { S.notes = notes.value; save(); });

    const screen = h('div', { class: 'screen result' },
      h('header', { class: 'qbar plain' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ホームへ', onClick: () => renderHome() }, '×'),
        h('span', { class: 'count', text: '結果' })),
      h('main', { class: 'qmain' },
        h('div', { class: 'score' }, scoreRing(score, total),
          h('div', { class: 'score-num' }, h('strong', { text: String(score) }), h('span', { text: ' / ' + total })),
          h('p', { class: 'score-lv', text: LEVELS[S.level || 'beginner'].label + 'レベル' })),
        h('p', { class: 'score-msg', text: msg }),
        catRows.length ? h('div', { class: 'card' }, h('h2', { class: 'sec', text: '分野別' }), catRows) : null,
        h('div', { class: 'card' }, h('h2', { class: 'sec', text: '問題ごとの結果' }), list),
        h('div', { class: 'card tester' },
          h('h2', { class: 'sec', text: 'テスターの方へ' }),
          h('p', { class: 'muted', text: '試作版の改善に使います。気づいたことを書いて「結果と感想をコピー」を押し、LINEやメールで送ってください。' }),
          notes,
          h('button', { type: 'button', class: 'btn ghost', onClick: () => copyReport() }, '📋 結果と感想をコピー')),
        h('div', { class: 'res-actions' },
          wrong.length ? h('button', { type: 'button', class: 'btn primary', onClick: () => startRound(S.level, wrong, 'retry') }, '間違えた問題をもう一度（' + wrong.length + '問）') : null,
          h('button', { type: 'button', class: 'btn ghost', onClick: () => startRound(S.level) }, '最初からやり直す'),
          h('button', { type: 'button', class: 'btn ghost', onClick: () => renderHome() }, 'レベルを変える'))));
    app.appendChild(screen);
    scrollTopNow();
    requestAnimationFrame(() => setTimeout(() => {
      const v = screen.querySelector('.ring-val'); if (v) v.setAttribute('stroke-dashoffset', v.getAttribute('data-off'));
    }, 60));
    if (ratio >= 0.9 && total) { Sound.good(); buzz([20, 40, 20]); }
  }

  function copyReport() {
    const lines = ['【8人制審判クイズ 試作版 フィードバック】', 'レベル: ' + LEVELS[S.level || 'beginner'].label];
    S.order.forEach(id => {
      const r = S.results[id], q = QMAP[id];
      const m = !r ? '未' : r.skipped ? 'スキップ' : r.ok ? '○' : '×';
      const rate = S.ratings[id] === 'hard' ? '（わかりにくい）' : S.ratings[id] === 'good' ? '（わかりやすい）' : '';
      lines.push(id + ' ' + q.title + ': ' + m + rate);
    });
    lines.push('感想: ' + (S.notes || '（なし）'));
    lines.push('端末: ' + navigator.userAgent);
    const text = lines.join('\n');
    const done = () => toast('コピーしました');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした'); }
      ta.remove();
    }
  }

  /* ================================================= 起動 */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideGloss(); });
  // 監修・テスト用：#q=H-01&lv=grade4 で指定の問題を直接開く（記録しない復習モード）
  const m = location.hash.match(/q=([A-H]-\d{2})/);
  if (m && QMAP[m[1]]) {
    const l = location.hash.match(/lv=(beginner|grade4)/);
    if (l) S.level = l[1];
    if (!S.level) S.level = 'beginner';
    if (!S.order.length) S.order = D.QUESTIONS.map(q => q.id);
    mountQuestion(QMAP[m[1]], { review: true });
  } else renderHome();
})();