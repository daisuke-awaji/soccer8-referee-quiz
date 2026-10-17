/**
 * H-01「横からのスライディングタックル」の3Dシーン。
 * 主審・副審・真横・真上の4つの視点で、同じ動きを見比べられる。
 */
import * as THREE from 'three';
import type { Scene3DDef } from '../../content/schema';
import { Scene3DBase, type Cam } from '../base';
import type { Scene3DEngine, Scene3DOptions } from '../index';
import { applyPose, fitLabels, makeLabel, makePerson, type Person } from '../kit';
import { poseIdle, poseJog } from '../pose';
import {
  ATTACKER_FOOT,
  BALL_R,
  BALL_Z,
  CONTACT_T,
  GOAL_LINE_X,
  ballGapAtContact,
  ballX,
  poseAttacker,
  poseDefender,
} from './slidingTackleMotion';

type CameraId = 'referee' | 'assistant' | 'side' | 'top';
const CAMS: Record<CameraId, Cam> = {
  referee: { pos: [-6.5, 1.65, -4.2], target: [8.6, 0.45, 0.3], fov: 36, up: [0, 1, 0] },
  assistant: { pos: [21.5, 1.6, -25.6], target: [8.4, 0.35, 0.2], fov: 15, up: [0, 1, 0] },
  side: { pos: [9.2, 1.25, 8.2], target: [9.2, 0.4, 0], fov: 50, up: [0, 1, 0] },
  top: { pos: [9.0, 15, 0.01], target: [9.0, 0, 0], fov: 40, up: [1, 0, 0] },
};

class SlidingTackleScene extends Scene3DBase {
  readonly cameras = [
    { id: 'referee', label: '主審の位置' },
    { id: 'assistant', label: '副審の位置' },
    { id: 'side', label: '真横' },
    { id: 'top', label: '真上' },
  ];
  readonly initialCamera = 'referee';
  readonly explainCamera = 'side';
  readonly contactAt = CONTACT_T;
  readonly contactLabel = '接触の瞬間';
  readonly legend = [
    { cls: 'd-red', label: '赤10番（攻撃）' },
    { cls: 'd-blue', label: '青4番（守備）' },
    { cls: 'd-gk', label: 'GK' },
    { cls: 'd-ref', label: '黒＝審判' },
    { cls: 'd-sole', label: '黄色＝スパイクの裏' },
  ];
  private A!: Person;
  private D!: Person;
  private GK!: Person;
  private B5!: Person;
  private R9!: Person;
  private REF!: Person;
  private AR!: Person;
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private ana!: THREE.Group;
  private anaRing!: THREE.Mesh;

  constructor(container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions) {
    super(container, def, opts, '3Dで再現したタックルの場面', GOAL_LINE_X);
    this.buildPeople();
    this.buildAnalysis();
    this.start();
  }

  protected cam(id: string): Cam {
    return CAMS[id as CameraId] ?? CAMS.referee;
  }

  private buildPeople() {
    const red = { shirt: '#e53935', shorts: '#ffffff', socks: '#e53935' };
    const blue = { shirt: '#1e63d6', shorts: '#0d2b66', socks: '#1e63d6' };
    const black = { shirt: '#151515', shorts: '#151515', socks: '#151515', number: null };
    this.A = makePerson(this.scene, { ...red, number: 10 });
    this.D = makePerson(this.scene, { ...blue, number: 4 });
    this.GK = makePerson(this.scene, { shirt: '#ffb300', shorts: '#222', socks: '#ffb300', number: 1, numColor: '#222', longSleeve: true });
    this.B5 = makePerson(this.scene, { ...blue, number: 5 });
    this.R9 = makePerson(this.scene, { ...red, number: 9 });
    this.REF = makePerson(this.scene, black);
    this.AR = makePerson(this.scene, black);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), new THREE.MeshBasicMaterial({ color: '#ffd600', side: THREE.DoubleSide }));
    flag.position.set(0.12, -0.5, 0.1);
    this.AR.armR.el.add(flag);
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
    this.ball.add(new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R * 1.003, 0), new THREE.MeshBasicMaterial({ color: '#222', wireframe: true })));
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.2, 16),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
  }

  /** 解説用：接触の瞬間のボールの位置・足からの距離・足裏の向き */
  private buildAnalysis() {
    const g = new THREE.Group();
    g.visible = false;
    this.scene.add(g);
    this.ana = g;
    const bx = ballX(CONTACT_T);
    const ghost = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthTest: false }),
    );
    ghost.position.set(bx, BALL_R, BALL_Z);
    ghost.renderOrder = 9;
    g.add(ghost);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ATTACKER_FOOT.x, 0.04, ATTACKER_FOOT.z),
      new THREE.Vector3(bx, 0.04, BALL_Z),
    ]);
    const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffeb3b', depthTest: false }));
    ln.renderOrder = 9;
    g.add(ln);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 32),
      new THREE.MeshBasicMaterial({ color: '#ff5252', depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(ATTACKER_FOOT.x, 0.03, ATTACKER_FOOT.z);
    ring.renderOrder = 9;
    g.add(ring);
    this.anaRing = ring;
    const l1 = makeLabel(`ボールは約${ballGapAtContact().toFixed(1)}m前`, '#ffeb3b', 0.34);
    l1.position.set((ATTACKER_FOOT.x + bx) / 2, 1.0, BALL_Z);
    g.add(l1);
    const l2 = makeLabel('足裏がすねへ', '#ff8a80', 0.28);
    l2.position.set(ATTACKER_FOOT.x - 0.2, 0.62, ATTACKER_FOOT.z + 0.5);
    g.add(l2);
  }

  protected pose(t: number) {
    applyPose(this.A, poseAttacker(t));
    applyPose(this.D, poseDefender(t));
    applyPose(this.GK, poseIdle({ x: GOAL_LINE_X - 0.8, z: 0 }, Math.PI, t));
    applyPose(this.B5, poseJog({ x: 22, z: -6 }, { x: 21, z: -3 }, t, 3.6, 1.6));
    applyPose(this.R9, poseJog({ x: 11, z: -9 }, { x: 17.5, z: -7.5 }, t, 3.6, 2.3));
    applyPose(this.REF, poseJog({ x: -6.9, z: -4.4 }, { x: -5.6, z: -4.1 }, t, 3.6, 1.6));
    applyPose(this.AR, poseJog({ x: 21.0, z: -25.8 }, { x: 21.6, z: -25.8 }, t, 3.6, 1.2));
    // 自分の視点の審判は表示しない
    this.REF.root.visible = this.camId !== 'referee';
    this.AR.root.visible = this.camId !== 'assistant';
    const bx = ballX(t);
    this.ball.position.set(bx, BALL_R, BALL_Z);
    this.ball.rotation.z = -bx / BALL_R;
    this.ballShadow.position.set(bx + 0.03, 0.008, BALL_Z);
    this.ana.visible = this.analysis && t >= CONTACT_T - 0.02;
  }
  protected frame(now: number): boolean {
    if (!this.analysis) return false;
    const s = 1 + 0.18 * Math.sin(now / 160);
    this.anaRing.scale.set(s, s, s);
    return this.ana.visible;
  }
  protected beforeRender() {
    if (this.ana.visible) fitLabels(this.ana, this.camera);
  }
}

export function create(container: HTMLElement, def: Scene3DDef, opts: Scene3DOptions): Scene3DEngine {
  return new SlidingTackleScene(container, def, opts);
}
