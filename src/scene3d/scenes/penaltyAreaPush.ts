/**
 * H-04「クロスの前、PA内で押した」の3Dシーン。
 * 全体の視点で主審の立ち位置（候補 A〜）を選ぶと、その位置の目の高さから続きを見られる。
 * 押した手が見えるか・副審が視野に入るか・プレーのじゃまにならないかを、画面に出す。
 */
import * as THREE from 'three';
import type { Position3DCandidate, Scene3DDef } from '../../content/schema';
import { Scene3DBase, type Cam } from '../base';
import type { CameraTab, Scene3DEngine, Scene3DOptions } from '../index';
import { applyPose, fitLabels, makeLabel, makePerson, type Person } from '../kit';
import { basePose, yawOf, type XZ } from '../pose';
import {
  BALL_R,
  CONTACT_T,
  CROSS_PATH,
  EYE_H,
  GOAL_LINE_X,
  PUSH_ARM_YAW,
  VIEW_HALF_DEG,
  arAt,
  ballAt,
  fieldTo3D,
  poseAR,
  poseB2,
  poseB3,
  poseB5,
  poseGK,
  poseR11,
  poseR7,
  poseR9,
  pushK,
  pushPoint,
  viewCheck,
  type ViewCheck,
} from './penaltyAreaPushMotion';

/** 全体の視点。人物は 1.4 倍で表示する（候補の位置から見る視点は実寸） */
const OVERVIEW: Cam = { pos: [-1, 23, -6.5], target: [15, 0, -6.5], fov: 50, hfov: 72, up: [0, 1, 0], people: 1.4 };
const COLORS = { pick: '#ffd600', ok: '#2e7d32', ng: '#d32f2f', dim: '#9e9e9e' };

interface Cand {
  def: Position3DCandidate;
  at: XZ;
  check: ViewCheck;
  ring: THREE.Mesh;
  btn: HTMLButtonElement;
}

class PenaltyAreaPushScene extends Scene3DBase {
  readonly initialCamera = 'overview';
  readonly explainCamera = 'overview';
  readonly contactAt = CONTACT_T;
  readonly contactLabel = '押した瞬間';
  readonly legend = [
    { cls: 'd-red', label: '赤（攻撃）' },
    { cls: 'd-blue', label: '青（守備）' },
    { cls: 'd-gk', label: 'GK（青のチーム）' },
    { cls: 'd-ref', label: '黒＝審判（旗は副審）' },
    { cls: 'd-cand', label: '黄色の丸＝主審の立ち位置の候補' },
  ];
  private people: Record<string, Person> = {};
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private cands: Cand[] = [];
  private selected: string | null = null;
  private answer: string | null = null;
  private picked: string | null = null;
  private onPick: ((id: string) => void) | null = null;
  private readonly layer: HTMLDivElement;
  private readonly chips: HTMLDivElement;
  private ana!: THREE.Group;
  private anaRing!: THREE.Mesh;
  private wedge: THREE.Group | null = null;
  /** 候補の位置から見ているときに、副審の頭の上に出す名札 */
  private arTag = new THREE.Group();

  constructor(container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions) {
    super(container, def, opts, '3Dで再現した、ペナルティーエリアの中で押した場面', GOAL_LINE_X);
    this.layer = document.createElement('div');
    this.layer.className = 's3-cands';
    this.chips = document.createElement('div');
    this.chips.className = 's3-check';
    this.chips.setAttribute('aria-live', 'polite');
    this.chips.hidden = true;
    container.append(this.layer, this.chips);
    this.buildPeople();
    this.buildAnalysis();
    this.start();
  }

  get cameras(): ReadonlyArray<CameraTab> {
    return [{ id: 'overview', label: '全体' }, ...this.cands.map((c) => ({ id: c.def.id, label: `${c.def.id}から` }))];
  }

  protected cam(id: string): Cam {
    const c = this.cands.find((x) => x.def.id === id);
    if (!c) return OVERVIEW;
    const p = pushPoint();
    return { pos: [c.at.x, EYE_H, c.at.z], target: [p.x, 1.0, p.z], fov: 50, hfov: 2 * VIEW_HALF_DEG, up: [0, 1, 0] };
  }

  private buildPeople() {
    const red = { shirt: '#e53935', shorts: '#ffffff', socks: '#e53935', disc: '#e53935' };
    const blue = { shirt: '#1e63d6', shorts: '#0d2b66', socks: '#1e63d6', disc: '#1e63d6' };
    const black = { shirt: '#151515', shorts: '#151515', socks: '#151515', number: null };
    const P = this.people;
    P.R7 = makePerson(this.scene, { ...red, number: 7 });
    P.R9 = makePerson(this.scene, { ...red, number: 9 });
    P.R11 = makePerson(this.scene, { ...red, number: 11 });
    P.B2 = makePerson(this.scene, { ...blue, number: 2 });
    P.B3 = makePerson(this.scene, { ...blue, number: 3 });
    P.B5 = makePerson(this.scene, { ...blue, number: 5 });
    P.GK = makePerson(this.scene, { shirt: '#ffb300', shorts: '#222', socks: '#ffb300', number: 1, numColor: '#222', longSleeve: true, disc: blue.disc });
    P.AR = makePerson(this.scene, black);
    P.REF = makePerson(this.scene, black);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), new THREE.MeshBasicMaterial({ color: '#ffd600', side: THREE.DoubleSide }));
    flag.position.set(0.12, -0.5, 0.1);
    P.AR.armR.el.add(flag);
    this.arTag.add(makeLabel('副審', '#ffffff', 0.13));
    this.scene.add(this.arTag);
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
    this.ball.add(new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R * 1.003, 0), new THREE.MeshBasicMaterial({ color: '#222', wireframe: true })));
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.2, 16),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    this.scalable.push(...Object.values(P).map((x) => x.root), this.ball, this.ballShadow);
  }

  /** 解説用：押した位置の印・ボールのコース */
  private buildAnalysis() {
    const g = new THREE.Group();
    g.visible = false;
    this.scene.add(g);
    this.ana = g;
    const p = pushPoint();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: '#ff5252', depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x - 0.2, 0.03, p.z);
    ring.renderOrder = 9;
    g.add(ring);
    this.anaRing = ring;
    const pts = CROSS_PATH.map((q) => new THREE.Vector3(q.x, 0.05, q.z));
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.6, gapSize: 0.4, depthTest: false }),
    );
    path.computeLineDistances();
    path.renderOrder = 8;
    g.add(path);
    const l1 = makeLabel('押した手', '#ff8a80', 0.2);
    l1.position.set(p.x, 2.0, p.z);
    g.add(l1);
  }

  /** 正解の位置からの視野（±VIEW_HALF_DEG）と、副審への線 */
  private buildWedge(c: Cand) {
    this.wedge?.removeFromParent();
    const g = new THREE.Group();
    const p = pushPoint();
    const a = Math.atan2(p.z - c.at.z, p.x - c.at.x);
    const half = (VIEW_HALF_DEG * Math.PI) / 180;
    const fan = new THREE.Mesh(
      new THREE.CircleGeometry(22, 32, -a - half, 2 * half),
      new THREE.MeshBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(c.at.x, 0.02, c.at.z);
    g.add(fan);
    const ar = arAt(CONTACT_T);
    for (const [to, color] of [
      [p, '#ffeb3b'],
      [ar, '#ffffff'],
    ] as const) {
      const ln = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(c.at.x, 0.06, c.at.z), new THREE.Vector3(to.x, 0.06, to.z)]),
        new THREE.LineBasicMaterial({ color, depthTest: false }),
      );
      ln.renderOrder = 8;
      g.add(ln);
    }
    const lab = makeLabel('主審の視野', '#ffeb3b', 0.2);
    lab.position.set(c.at.x + (p.x - c.at.x) * 0.45, 0.6, c.at.z + (p.z - c.at.z) * 0.45);
    g.add(lab);
    this.ana.add(g);
    this.wedge = g;
  }

  /* ---------------- 立ち位置の候補 */
  showCandidates(list: ReadonlyArray<Position3DCandidate>, onPick: (id: string) => void) {
    for (const c of this.cands) {
      c.ring.removeFromParent();
      c.btn.remove();
    }
    this.onPick = onPick;
    this.cands = list.map((def) => {
      const at = fieldTo3D(def.at);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.85, 32),
        new THREE.MeshBasicMaterial({ color: COLORS.pick, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, 0.04, at.z);
      ring.renderOrder = 7;
      this.scene.add(ring);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 's3-cand';
      btn.dataset.id = def.id;
      btn.textContent = def.id;
      btn.setAttribute('aria-label', `立ち位置 ${def.id}：${def.text}`);
      btn.addEventListener('click', () => this.onPick?.(def.id));
      this.layer.append(btn);
      return { def, at, check: viewCheck(at), ring, btn };
    });
    this.update(this.t);
    this.renderOnce();
  }
  selectCandidate(id: string | null) {
    this.selected = id;
    this.paintCandidates();
    this.renderOnce();
  }
  revealCandidates(answer: string, picked: string | null) {
    this.answer = answer;
    this.picked = picked;
    this.onPick = null;
    const c = this.cands.find((x) => x.def.id === answer);
    if (c) this.buildWedge(c);
    this.paintCandidates();
    this.update(this.t);
    this.renderOnce();
  }
  private paintCandidates() {
    for (const c of this.cands) {
      const id = c.def.id;
      let color = COLORS.pick;
      let cls = 's3-cand';
      if (this.answer) {
        color = id === this.answer ? COLORS.ok : id === this.picked ? COLORS.ng : COLORS.dim;
        cls += id === this.answer ? ' ok' : id === this.picked ? ' ng' : ' dim';
        c.btn.disabled = true;
      } else if (id === this.selected) cls += ' sel';
      c.btn.className = cls;
      c.btn.setAttribute('aria-pressed', String(!this.answer && id === this.selected));
      (c.ring.material as THREE.MeshBasicMaterial).color.set(color);
      c.ring.scale.setScalar(!this.answer && id === this.selected ? 1.35 : 1);
    }
  }

  /* ---------------- 動き */
  protected pose(t: number) {
    const P = this.people;
    applyPose(P.R7!, poseR7(t));
    applyPose(P.R9!, poseR9(t));
    applyPose(P.R11!, poseR11(t));
    applyPose(P.B2!, poseB2(t));
    applyPose(P.B3!, poseB3(t));
    const k = pushK(t);
    P.B3!.armL.sh.rotation.y = -PUSH_ARM_YAW * k;
    P.B3!.armR.sh.rotation.y = PUSH_ARM_YAW * k;
    applyPose(P.B5!, poseB5(t));
    applyPose(P.GK!, poseGK(t));
    applyPose(P.AR!, poseAR(t));
    const ar = arAt(t);
    this.arTag.position.set(ar.x, 2.25, ar.z);
    // 主審：候補の位置から見ているときは表示しない。全体の視点では、解答後に正解の位置に立たせる
    const view = this.cands.find((c) => c.def.id === this.camId);
    const stand = !view && this.answer ? this.cands.find((c) => c.def.id === this.answer) : undefined;
    P.REF!.root.visible = !!stand;
    if (stand) {
      const p = pushPoint();
      const r = basePose();
      r.x = stand.at.x;
      r.z = stand.at.z;
      r.yaw = yawOf(p.x - stand.at.x, p.z - stand.at.z);
      applyPose(P.REF!, r);
    }
    const b = ballAt(t);
    this.ball.position.set(b.x, b.y, b.z);
    this.ball.rotation.z = -b.x / BALL_R;
    this.ballShadow.position.set(b.x + 0.03, 0.008, b.z);
    const overview = !view;
    this.layer.hidden = !overview || this.cands.length === 0;
    for (const c of this.cands) c.ring.visible = overview;
    this.arTag.visible = !overview;
    this.ana.visible = this.analysis && overview;
    this.showChecks(view && t >= CONTACT_T - 0.01 ? view : null);
  }

  private showChecks(c: Cand | null) {
    if (!c) {
      this.chips.hidden = true;
      return;
    }
    const v = c.check;
    const row = (ok: boolean, yes: string, no: string) => `<li class="${ok ? 'ok' : 'ng'}"><b>${ok ? '○' : '×'}</b>${ok ? yes : no}</li>`;
    const html =
      `<p>${c.def.id} の位置から</p><ul>` +
      row(v.handsVisible, '押した手が見える', '押した手が隠れて見えない') +
      row(v.arInView, '副審が視野に入る', '副審が視野に入らない') +
      row(v.clearOfPlay, 'プレーのじゃまにならない', 'ボールのコースに近く、じゃまになる') +
      '</ul>';
    if (this.chips.innerHTML !== html) this.chips.innerHTML = html;
    this.chips.hidden = false;
  }

  protected frame(now: number): boolean {
    if (!this.ana.visible) return false;
    const s = 1 + 0.15 * Math.sin(now / 160);
    this.anaRing.scale.set(s, s, s);
    return true;
  }

  protected beforeRender() {
    if (this.ana.visible) fitLabels(this.ana, this.camera);
    if (this.wedge && this.ana.visible) fitLabels(this.wedge, this.camera);
    if (this.arTag.visible) fitLabels(this.arTag, this.camera);
    if (this.layer.hidden) return;
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    for (const c of this.cands) {
      v.set(c.at.x, 0, c.at.z).project(this.camera);
      c.btn.style.left = (((v.x + 1) / 2) * 100).toFixed(2) + '%';
      c.btn.style.top = (((1 - v.y) / 2) * 100).toFixed(2) + '%';
    }
  }
}

export function create(container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions): Scene3DEngine {
  return new PenaltyAreaPushScene(container, def, opts);
}
