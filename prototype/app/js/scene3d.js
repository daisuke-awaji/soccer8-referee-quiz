/* 3D シーン：横からのスライディングタックル（H-01）
 * three.js を CDN から動的に読み込む（3D問題に来たときだけ）。
 * 座標: X = 攻撃方向（青ゴールは x=26）, Y = 上, Z = 横（赤10番の右手側が +Z）
 */
(function () {
  'use strict';
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
  let THREE = null;
  async function loadThree() {
    if (!THREE) THREE = await import(THREE_URL);
    return THREE;
  }

  const HIP_H = 0.74;      // 骨盤の高さ（U-12 想定 身長約1.5m）
  const TC = 1.6;          // 接触の瞬間
  const BALL_R = 0.12;     // 4号球（少し大きめに表示）

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = k => k * k * (3 - 2 * k);
  const POSE_KEYS = ['x', 'z', 'y', 'yaw', 'lean', 'roll', 'hipL', 'kneeL', 'ankL', 'hipR', 'kneeR', 'ankR', 'shL', 'elL', 'shR', 'elR', 'abL', 'abR'];
  function basePose() { return { x: 0, z: 0, y: HIP_H, yaw: 0, lean: 0, roll: 0, hipL: 0, kneeL: -0.05, ankL: 0, hipR: 0, kneeR: -0.05, ankR: 0, shL: 0, elL: 0.25, shR: 0, elR: 0.25, abL: 0.1, abR: 0.1 }; }
  function blend(a, b, k) { const o = {}; POSE_KEYS.forEach(key => { o[key] = lerp(a[key], b[key], k); }); return o; }
  function runPose(p, phase, amp) {
    const s = Math.sin(phase), c = Math.cos(phase);
    p.hipL = amp * 0.75 * s; p.hipR = -amp * 0.75 * s;
    p.kneeL = -(0.12 + amp * 1.1 * Math.max(0, c));
    p.kneeR = -(0.12 + amp * 1.1 * Math.max(0, -c));
    p.shL = -amp * 0.7 * s; p.shR = amp * 0.7 * s; p.elL = p.elR = 1.2;
    p.y = HIP_H - 0.035 + 0.035 * Math.abs(c);
    p.lean = -0.14 * amp;
    return p;
  }
  const yawOf = (dx, dz) => Math.atan2(-dz, dx);

  /* ---------------------------------------------------- 振り付け */
  // ボール：最後のタッチは t=1.1、初速 9m/s、減速 2.4m/s²
  function ballX(t) {
    const t0 = 1.1;
    if (t <= t0) return 5 * t + 0.45 + 0.3 * ((t * 2.5) % 1);
    const b0 = 5 * t0 + 0.45 + 0.3 * ((t0 * 2.5) % 1);
    const dt = Math.min(t - t0, 9 / 2.4);
    return b0 + 9 * dt - 1.2 * dt * dt;
  }
  const BALL_Z = 0.06;
  const A_FOOT = { x: 5 * TC, y: 0.2, z: 0.09 }; // 接触時の赤10番の右足（軸足）

  // 青4番のスライディング経路
  const D_P0 = { x: 1.5, z: 7.5 }, D_P1 = { x: 6.0, z: 2.3 };
  const D_DIR = (function () { const dx = A_FOOT.x - D_P1.x, dz = A_FOOT.z - D_P1.z, n = Math.hypot(dx, dz); return { x: dx / n, z: dz / n }; })();
  const D_RIGHT = { x: -D_DIR.z, z: D_DIR.x };
  const REACH = 0.72 + 0.15;
  const D_PC = { x: A_FOOT.x - D_DIR.x * REACH - D_RIGHT.x * 0.09, z: A_FOOT.z - D_DIR.z * REACH - D_RIGHT.z * 0.09 };
  const D_PE = { x: D_PC.x + D_DIR.x * 0.7, z: D_PC.z + D_DIR.z * 0.7 };

  function poseAttacker(t) {
    const p = basePose();
    if (t <= TC) {
      runPose(p, 2 * Math.PI * 2.5 * t, 1);
      p.x = 5 * t; p.z = 0; p.yaw = 0;
      return p;
    }
    const dt = t - TC;
    const k = clamp(dt / 0.75, 0, 1), e = k * k;
    runPose(p, 0, 1 - k);
    const dd = Math.min(dt, 1.0);
    p.x = 5 * TC + 4.4 * dd - 1.9 * dd * dd;
    p.z = 0.05 * k;
    p.yaw = 0.08 * k;
    p.lean = lerp(-0.14, -1.47, e);
    p.y = lerp(HIP_H, 0.17, e);
    p.hipR = lerp(0, -0.75, smooth(clamp(dt / 0.3, 0, 1)));
    p.kneeR = lerp(-0.12, -1.1, smooth(clamp(dt / 0.35, 0, 1)));
    p.hipL = lerp(0, 0.35, k); p.kneeL = lerp(-1.2, -0.5, k);
    p.shL = p.shR = lerp(0.3, 2.7, smooth(clamp(dt / 0.45, 0, 1)));
    p.elL = p.elR = lerp(1.2, 0.35, k);
    p.abL = p.abR = lerp(0.1, 0.35, k);
    if (dt > 1.2) { const k2 = smooth(clamp((dt - 1.2) / 0.5, 0, 1)); p.kneeR = lerp(p.kneeR, -1.9, k2); p.hipR = lerp(p.hipR, -0.3, k2); }
    return p;
  }
  function slidePose() {
    return Object.assign(basePose(), {
      y: 0.25, lean: 0.9, hipR: 0.7, kneeR: 0, ankR: -0.1, hipL: 0.45, kneeL: -2.45, ankL: 0.9,
      shL: -0.95, elL: 0.2, abL: 0.4, shR: 0.55, elR: 0.6, abR: 0.35
    });
  }
  function poseDefender(t) {
    const yawRun = yawOf(D_P1.x - D_P0.x, D_P1.z - D_P0.z), yawSlide = yawOf(D_DIR.x, D_DIR.z);
    if (t <= 1.2) {
      const p = runPose(basePose(), 2 * Math.PI * 2.7 * t, 1);
      const k = t / 1.2;
      p.x = lerp(D_P0.x, D_P1.x, k); p.z = lerp(D_P0.z, D_P1.z, k);
      p.yaw = lerp(yawRun, yawSlide, smooth(clamp((t - 0.9) / 0.3, 0, 1)));
      return p;
    }
    let p;
    if (t <= 1.33) {
      const run = runPose(basePose(), 2 * Math.PI * 2.7 * t, 1);
      p = blend(run, slidePose(), smooth((t - 1.2) / 0.13));
    } else p = slidePose();
    p.yaw = yawSlide;
    if (t <= TC) {
      const k = (t - 1.2) / (TC - 1.2);
      p.x = lerp(D_P1.x, D_PC.x, k); p.z = lerp(D_P1.z, D_PC.z, k);
    } else {
      const k = 1 - Math.pow(1 - clamp((t - TC) / 0.5, 0, 1), 2);
      p.x = lerp(D_PC.x, D_PE.x, k); p.z = lerp(D_PC.z, D_PE.z, k);
      if (t > 2.1) {
        const k2 = smooth(clamp((t - 2.1) / 0.6, 0, 1));
        p.lean = lerp(0.9, 0.35, k2); p.hipR = lerp(0.7, 1.65, k2); p.kneeR = lerp(0, -1.2, k2);
        p.hipL = lerp(0.45, 0.95, k2);
        p.shL = lerp(-0.95, -0.35, k2); p.y = lerp(0.25, 0.22, k2);
      }
    }
    return p;
  }
  function poseJog(from, to, t, T, speedHz) {
    const k = clamp(t / T, 0, 1);
    const p = runPose(basePose(), 2 * Math.PI * speedHz * t, 0.55);
    p.x = lerp(from.x, to.x, k); p.z = lerp(from.z, to.z, k);
    p.yaw = yawOf(to.x - from.x, to.z - from.z);
    return p;
  }
  function poseIdle(at, yaw, t) {
    const p = basePose();
    p.x = at.x; p.z = at.z; p.yaw = yaw;
    p.kneeL = p.kneeR = -0.35; p.hipL = p.hipR = 0.25; p.y = HIP_H - 0.05; p.lean = -0.2;
    p.shL = p.shR = 0.3; p.abL = p.abR = 0.35; p.elL = p.elR = 0.6;
    p.z += Math.sin(t * 2.2) * 0.12;
    return p;
  }

  /* ---------------------------------------------------- カメラ */
  const CAMS = {
    referee: { pos: [-6.5, 1.65, -4.2], target: [8.6, 0.45, 0.3], fov: 36, up: [0, 1, 0] },
    assistant: { pos: [21.5, 1.6, -25.6], target: [8.4, 0.35, 0.2], fov: 15, up: [0, 1, 0] },
    side: { pos: [9.2, 1.25, 8.2], target: [9.2, 0.4, 0], fov: 50, up: [0, 1, 0] },
    top: { pos: [9.0, 15, 0.01], target: [9.0, 0, 0], fov: 40, up: [1, 0, 0] }
  };

  class Scene3D {
    static async create(container, def, opts) {
      const T = await loadThree();
      return new Scene3D(T, container, def || {}, opts || {});
    }
    constructor(T, container, def, opts) {
      this.T = T; this.c = container; this.def = def; this.opts = opts;
      this.t = 0; this.camId = 'referee'; this.analysis = false;
      this._raf = null; this._playing = false; this._camAnim = null;
      const canvas = document.createElement('canvas');
      canvas.className = 'scene3d-canvas';
      canvas.setAttribute('aria-label', '3Dで再現したタックルの場面');
      this.c.innerHTML = '';
      this.c.appendChild(canvas);
      this.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.scene = new T.Scene();
      this.scene.background = new T.Color('#cfe6fb');
      this.scene.fog = new T.Fog('#cfe6fb', 45, 110);
      this.camera = new T.PerspectiveCamera(36, 4 / 3, 0.1, 200);
      this._applyCam(CAMS.referee);
      this.scene.add(new T.HemisphereLight('#eef6ff', '#41633a', 1.1));
      const dl = new T.DirectionalLight('#ffffff', 1.4);
      dl.position.set(12, 22, 9);
      this.scene.add(dl);
      this._buildField();
      this._buildPeople();
      this._buildAnalysis();
      this._resize();
      this._ro = new ResizeObserver(() => { this._resize(); this._renderOnce(); });
      this._ro.observe(this.c);
      this.seek(0);
    }

    /* ---------------- フィールド */
    _buildField() {
      const T = this.T, s = this.scene;
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 8;
      const g = cv.getContext('2d');
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3f8f3c' : '#47a043'; g.fillRect(i * 32, 0, 32, 8); }
      const tex = new T.CanvasTexture(cv);
      if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(80 / 80, 1);
      const ground = new T.Mesh(new T.PlaneGeometry(80, 70), new T.MeshLambertMaterial({ map: tex }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(-8 + 40 - 6, 0, 0);
      s.add(ground);
      const lineMat = new T.MeshBasicMaterial({ color: '#f4f7f4' });
      const seg = (x1, z1, x2, z2) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const m = new T.Mesh(new T.PlaneGeometry(len, 0.1), lineMat);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1);
        m.position.set((x1 + x2) / 2, 0.006, (z1 + z2) / 2);
        s.add(m);
      };
      const GL = 26; // ゴールライン
      seg(GL, -25, GL, 25);
      seg(GL - 12, -14.5, GL - 12, 14.5); seg(GL - 12, -14.5, GL, -14.5); seg(GL - 12, 14.5, GL, 14.5);
      seg(GL - 4, -6.5, GL - 4, 6.5); seg(GL - 4, -6.5, GL, -6.5); seg(GL - 4, 6.5, GL, 6.5);
      seg(-8, -25, -8, 25);           // ハーフウェーライン
      seg(-40, -25, GL, -25); seg(-40, 25, GL, 25);  // タッチライン
      const ring = (cx, r, a0, al) => {
        const m = new T.Mesh(new T.RingGeometry(r - 0.05, r + 0.05, 64, 1, a0, al), lineMat);
        m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.006, 0); s.add(m);
      };
      const ac = Math.acos(4 / 7);
      ring(GL - 8, 7, Math.PI - ac, 2 * ac);   // ペナルティーアーク
      ring(-8, 7, 0, Math.PI * 2);              // センターサークル
      const pk = new T.Mesh(new T.CircleGeometry(0.12, 16), lineMat); pk.rotation.x = -Math.PI / 2; pk.position.set(GL - 8, 0.007, 0); s.add(pk);
      // ゴール 5m × 2.15m
      const postMat = new T.MeshLambertMaterial({ color: '#ffffff' });
      [-2.5, 2.5].forEach(z => { const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.15, 10), postMat); p.position.set(GL, 1.075, z); s.add(p); });
      const bar = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 5.1, 10), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(GL, 2.15, 0); s.add(bar);
      const net = new T.Mesh(new T.BoxGeometry(1.4, 2.15, 5, 3, 5, 12), new T.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.35 }));
      net.position.set(GL + 0.72, 1.075, 0); s.add(net);
    }

    /* ---------------- 人物 */
    _numberTex(num, fg) {
      const T = this.T;
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      const g = cv.getContext('2d');
      g.fillStyle = fg; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(num), 64, 70);
      const t = new T.CanvasTexture(cv);
      if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
      return t;
    }
    _makePerson(o) {
      const T = this.T;
      const M = c => new T.MeshLambertMaterial({ color: c });
      const shirt = M(o.shirt), shorts = M(o.shorts), socks = M(o.socks), skin = M('#e8b98f'), boot = M('#1b1b1b'), sole = new T.MeshLambertMaterial({ color: '#ffca28', emissive: '#8a6400' }), hair = M('#2b1d16');
      const root = new T.Group();
      const body = new T.Group(); body.position.y = HIP_H; root.add(body);
      const torso = new T.Mesh(new T.CapsuleGeometry(0.15, 0.3, 4, 10), shirt);
      torso.position.y = 0.3; torso.scale.set(0.78, 1, 1.22); body.add(torso);
      const pelvis = new T.Mesh(new T.CapsuleGeometry(0.13, 0.06, 4, 10), shorts);
      pelvis.position.y = 0.04; pelvis.scale.set(0.85, 1, 1.25); body.add(pelvis);
      const head = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), skin); head.position.y = 0.66; body.add(head);
      const hr = new T.Mesh(new T.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hair); hr.position.y = 0.67; hr.rotation.z = 0.25; body.add(hr);
      if (o.number != null) {
        const pl = new T.Mesh(new T.PlaneGeometry(0.22, 0.22), new T.MeshBasicMaterial({ map: this._numberTex(o.number, o.numColor || '#fff'), transparent: true }));
        pl.position.set(-0.122, 0.33, 0); pl.rotation.y = -Math.PI / 2; body.add(pl);
      }
      const limb = (r, len, mat) => { const m = new T.Mesh(new T.CapsuleGeometry(r, len, 4, 8), mat); m.position.y = -(len / 2 + r * 0.5); return m; };
      const mkArm = side => {
        const sh = new T.Group(); sh.position.set(0, 0.48, side * 0.2); body.add(sh);
        sh.add(limb(0.045, 0.19, o.longSleeve ? shirt : skin));
        const sleeve = new T.Mesh(new T.CapsuleGeometry(0.055, 0.06, 4, 8), shirt); sleeve.position.y = -0.05; sh.add(sleeve);
        const el = new T.Group(); el.position.y = -0.27; sh.add(el);
        el.add(limb(0.04, 0.18, skin));
        return { sh: sh, el: el };
      };
      const mkLeg = side => {
        const hip = new T.Group(); hip.position.set(0, 0, side * 0.09); body.add(hip);
        hip.add(limb(0.068, 0.24, skin));
        const sh = new T.Mesh(new T.CapsuleGeometry(0.078, 0.1, 4, 8), shorts); sh.position.y = -0.07; hip.add(sh);
        const knee = new T.Group(); knee.position.y = -0.36; hip.add(knee);
        knee.add(limb(0.052, 0.25, socks));
        const ank = new T.Group(); ank.position.y = -0.36; knee.add(ank);
        const foot = new T.Mesh(new T.BoxGeometry(0.21, 0.065, 0.085), boot); foot.position.set(0.05, -0.02, 0); ank.add(foot);
        const so = new T.Mesh(new T.BoxGeometry(0.23, 0.02, 0.1), sole); so.position.set(0.05, -0.06, 0); ank.add(so);
        return { hip: hip, knee: knee, ank: ank, sole: so };
      };
      const armL = mkArm(-1), armR = mkArm(1), legL = mkLeg(-1), legR = mkLeg(1);
      const blob = new T.Mesh(new T.CircleGeometry(0.38, 20), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; root.add(blob);
      this.scene.add(root);
      return { root: root, body: body, armL: armL, armR: armR, legL: legL, legR: legR, blob: blob };
    }
    _applyPose(P, p) {
      P.root.position.set(p.x, 0, p.z);
      P.root.rotation.y = p.yaw;
      P.body.position.y = p.y;
      P.body.rotation.z = p.lean;
      P.body.rotation.x = p.roll;
      P.legL.hip.rotation.z = p.hipL; P.legL.knee.rotation.z = p.kneeL; P.legL.ank.rotation.z = p.ankL;
      P.legR.hip.rotation.z = p.hipR; P.legR.knee.rotation.z = p.kneeR; P.legR.ank.rotation.z = p.ankR;
      P.armL.sh.rotation.z = p.shL; P.armL.sh.rotation.x = p.abL; P.armL.el.rotation.z = p.elL;
      P.armR.sh.rotation.z = p.shR; P.armR.sh.rotation.x = -p.abR; P.armR.el.rotation.z = p.elR;
      // 影は骨盤の真下（寝転ぶと少し前へ）
      const lx = Math.sin(-p.lean) * 0.35;
      P.blob.position.set(lx, 0.01, 0);
    }
    _buildPeople() {
      const T = this.T;
      this.A = this._makePerson({ shirt: '#e53935', shorts: '#ffffff', socks: '#e53935', number: 10 });
      this.D = this._makePerson({ shirt: '#1e63d6', shorts: '#0d2b66', socks: '#1e63d6', number: 4 });
      this.GK = this._makePerson({ shirt: '#ffb300', shorts: '#222', socks: '#ffb300', number: 1, numColor: '#222', longSleeve: true });
      this.B5 = this._makePerson({ shirt: '#1e63d6', shorts: '#0d2b66', socks: '#1e63d6', number: 5 });
      this.R9 = this._makePerson({ shirt: '#e53935', shorts: '#ffffff', socks: '#e53935', number: 9 });
      this.REF = this._makePerson({ shirt: '#151515', shorts: '#151515', socks: '#151515', number: null });
      this.AR = this._makePerson({ shirt: '#151515', shorts: '#151515', socks: '#151515', number: null });
      const flag = new T.Mesh(new T.PlaneGeometry(0.32, 0.24), new T.MeshBasicMaterial({ color: '#ffd600', side: T.DoubleSide }));
      flag.position.set(0.12, -0.5, 0.1); this.AR.armR.el.add(flag);
      this.ball = new T.Mesh(new T.IcosahedronGeometry(BALL_R, 1), new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
      const bw = new T.Mesh(new T.IcosahedronGeometry(BALL_R * 1.003, 0), new T.MeshBasicMaterial({ color: '#222', wireframe: true }));
      this.ball.add(bw);
      this.scene.add(this.ball);
      this.ballShadow = new T.Mesh(new T.CircleGeometry(BALL_R * 1.2, 16), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
      this.ballShadow.rotation.x = -Math.PI / 2; this.scene.add(this.ballShadow);
    }

    /* ---------------- 解説用のオーバーレイ */
    _label(text, color) {
      const T = this.T;
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const g = cv.getContext('2d');
      g.font = 'bold 60px system-ui, sans-serif';
      const w = Math.min(500, g.measureText(text).width + 56);
      g.fillStyle = 'rgba(0,0,0,0.72)';
      const x0 = (512 - w) / 2;
      g.beginPath(); if (g.roundRect) g.roundRect(x0, 14, w, 100, 30); else g.rect(x0, 14, w, 100); g.fill();
      g.fillStyle = color || '#ffeb3b'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 256, 66);
      const tex = new T.CanvasTexture(cv);
      if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.renderOrder = 10;
      sp.scale.set(1.6, 0.4, 1);
      return sp;
    }
    _buildAnalysis() {
      const T = this.T;
      const g = new T.Group(); g.visible = false; this.scene.add(g); this.ana = g;
      const bx = ballX(TC);
      this.ballGap = bx - A_FOOT.x;
      const ghost = new T.Mesh(new T.SphereGeometry(BALL_R, 16, 12), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthTest: false }));
      ghost.position.set(bx, BALL_R, BALL_Z); ghost.renderOrder = 9; g.add(ghost);
      const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(A_FOOT.x, 0.04, A_FOOT.z), new T.Vector3(bx, 0.04, BALL_Z)]);
      const ln = new T.Line(geo, new T.LineBasicMaterial({ color: '#ffeb3b', depthTest: false }));
      ln.renderOrder = 9; g.add(ln);
      const ring = new T.Mesh(new T.RingGeometry(0.3, 0.42, 32), new T.MeshBasicMaterial({ color: '#ff5252', depthTest: false, transparent: true, opacity: 0.95, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(A_FOOT.x, 0.03, A_FOOT.z); ring.renderOrder = 9; g.add(ring);
      this.anaRing = ring;
      const l1 = this._label('ボールは約' + this.ballGap.toFixed(1) + 'm前', '#ffeb3b');
      l1.userData.rel = 0.34;
      l1.position.set((A_FOOT.x + bx) / 2, 1.0, BALL_Z); g.add(l1);
      this.anaLabelGap = l1;
      const l2 = this._label('足裏がすねへ', '#ff8a80');
      l2.userData.rel = 0.28;
      l2.position.set(A_FOOT.x - 0.2, 0.62, A_FOOT.z + 0.5); g.add(l2);
    }

    /* ---------------- 更新 */
    _update(t) {
      this.t = t;
      this._applyPose(this.A, poseAttacker(t));
      this._applyPose(this.D, poseDefender(t));
      this._applyPose(this.GK, poseIdle({ x: 25.2, z: 0 }, Math.PI, t));
      this._applyPose(this.B5, poseJog({ x: 22, z: -6 }, { x: 21, z: -3 }, t, 3.6, 1.6));
      this._applyPose(this.R9, poseJog({ x: 11, z: -9 }, { x: 17.5, z: -7.5 }, t, 3.6, 2.3));
      this._applyPose(this.REF, poseJog({ x: -6.9, z: -4.4 }, { x: -5.6, z: -4.1 }, t, 3.6, 1.6));
      this._applyPose(this.AR, poseJog({ x: 21.0, z: -25.8 }, { x: 21.6, z: -25.8 }, t, 3.6, 1.2));
      this.REF.root.visible = this.camId !== 'referee';
      this.AR.root.visible = this.camId !== 'assistant';
      const bx = ballX(t);
      this.ball.position.set(bx, BALL_R, BALL_Z);
      this.ball.rotation.z = -bx / BALL_R;
      this.ballShadow.position.set(bx + 0.03, 0.008, BALL_Z);
      this.ana.visible = this.analysis && t >= TC - 0.02;
      if (this.opts.onTime) this.opts.onTime(t);
    }
    _renderOnce() {
      // ラベルは視点からの距離に応じて拡大し、どの視点でも同じくらいの大きさに見せる
      if (this.ana && this.ana.visible) {
        const th = Math.tan(this.camera.fov * Math.PI / 360);
        this.ana.children.forEach(o => {
          if (!o.isSprite) return;
          const d = this.camera.position.distanceTo(o.position);
          const w = 2 * d * th * (o.userData.rel || 0.3) * Math.max(1, 1 / this.camera.aspect);
          o.scale.set(w, w / 4, 1);
        });
      }
      this.renderer.render(this.scene, this.camera);
    }
    _resize() {
      const w = this.c.clientWidth || 320, h = this.c.clientHeight || 240;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    _applyCam(c) {
      this.camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
      this.camera.up.set(c.up[0], c.up[1], c.up[2]);
      this.camera.fov = c.fov;
      this.camera.lookAt(c.target[0], c.target[1], c.target[2]);
      this.camera.updateProjectionMatrix();
      this._camCur = { pos: c.pos.slice(), target: c.target.slice(), fov: c.fov, up: c.up.slice() };
    }
    _loop() {
      if (this._raf) return;
      let last = performance.now();
      const step = now => {
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        let busy = false;
        if (this._playing) {
          busy = true;
          const nt = Math.min(this._to, this.t + dt * this._speed);
          this._update(nt);
          if (this.opts.onProgress) this.opts.onProgress((nt - this._from) / Math.max(0.001, this._to - this._from));
          if (nt >= this._to) { this._playing = false; const cb = this._onEnd; this._onEnd = null; if (cb) cb(); }
        }
        if (this._camAnim) {
          busy = true;
          const a = this._camAnim; a.k = Math.min(1, a.k + dt / a.dur);
          const e = smooth(a.k);
          const mix = (p, q) => p.map((v, i) => lerp(v, q[i], e));
          const c = { pos: mix(a.from.pos, a.to.pos), target: mix(a.from.target, a.to.target), fov: lerp(a.from.fov, a.to.fov, e), up: mix(a.from.up, a.to.up) };
          this._applyCam(c);
          this._camCur = { pos: c.pos, target: c.target, fov: c.fov, up: c.up };
          if (a.k >= 1) this._camAnim = null;
        }
        if (this.analysis && this.anaRing) { const s = 1 + 0.18 * Math.sin(now / 160); this.anaRing.scale.set(s, s, s); busy = busy || this.ana.visible; }
        this._renderOnce();
        this._raf = busy ? requestAnimationFrame(step) : null;
      };
      this._raf = requestAnimationFrame(step);
    }

    /* ---------------- 公開 API */
    play(o) {
      this._from = o.from || 0; this._to = o.to != null ? o.to : (this.def.endAt || 3.6);
      this._speed = o.speed || 1; this._onEnd = o.onEnd || null;
      this._update(this._from);
      this._playing = true;
      this._loop();
    }
    stop() { this._playing = false; this._onEnd = null; }
    get playing() { return this._playing; }
    seek(t) { this.stop(); this._update(t); this._renderOnce(); this._loop(); }
    setCamera(id, animate) {
      const c = CAMS[id]; if (!c) return;
      this.camId = id;
      this._update(this.t);
      if (animate === false) { this._applyCam(c); this._renderOnce(); return; }
      this._camAnim = { from: this._camCur, to: { pos: c.pos, target: c.target, fov: c.fov, up: c.up }, k: 0, dur: 0.7 };
      this._loop();
    }
    setAnalysis(on) { this.analysis = !!on; this._update(this.t); this._renderOnce(); this._loop(); }
    get contactAt() { return TC; }
    get gap() { return this.ballGap; }
    destroy() {
      this.stop();
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      if (this._ro) this._ro.disconnect();
      try { this.renderer.dispose(); if (this.renderer.forceContextLoss) this.renderer.forceContextLoss(); } catch (_) {}
      this.c.innerHTML = '';
    }
  }

  Scene3D.CAMERAS = [
    { id: 'referee', label: '主審の位置' },
    { id: 'assistant', label: '副審の位置' },
    { id: 'side', label: '真横' },
    { id: 'top', label: '真上' }
  ];
  Scene3D.preload = loadThree;
  window.Scene3D = Scene3D;
})();
