/**
 * 3D シーンで使い回す部品（フィールド・人物・ラベル）。three.js を使う。
 * 座標: X = 攻撃方向（青ゴールのゴールラインは goalLineX）, Y = 上, Z = 横
 */
import * as THREE from 'three';
import { HIP_H, type Pose } from './pose';

function srgb<T extends THREE.Texture>(t: T): T {
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 8人制のフィールド（攻撃側の半分）とゴール */
export function buildField(scene: THREE.Scene, goalLineX: number): void {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 8;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#3f8f3c' : '#47a043';
    g.fillRect(i * 32, 0, 32, 8);
  }
  const tex = srgb(new THREE.CanvasTexture(cv));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 70), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(goalLineX, 0, 0);
  scene.add(ground);

  const lineMat = new THREE.MeshBasicMaterial({ color: '#f4f7f4' });
  const seg = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1);
    m.position.set((x1 + x2) / 2, 0.006, (z1 + z2) / 2);
    scene.add(m);
  };
  const GL = goalLineX;
  const half = GL - 34; // ハーフウェーライン（ゴールラインから34m）
  seg(GL, -25, GL, 25);
  seg(GL - 12, -14.5, GL - 12, 14.5);
  seg(GL - 12, -14.5, GL, -14.5);
  seg(GL - 12, 14.5, GL, 14.5);
  seg(GL - 4, -6.5, GL - 4, 6.5);
  seg(GL - 4, -6.5, GL, -6.5);
  seg(GL - 4, 6.5, GL, 6.5);
  seg(half, -25, half, 25);
  seg(GL - 66, -25, GL, -25);
  seg(GL - 66, 25, GL, 25);
  const ring = (cx: number, r: number, a0: number, al: number) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 64, 1, a0, al), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.006, 0);
    scene.add(m);
  };
  const ac = Math.acos(4 / 7);
  ring(GL - 8, 7, Math.PI - ac, 2 * ac); // ペナルティーアーク
  ring(half, 7, 0, Math.PI * 2); // センターサークル
  const pk = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), lineMat);
  pk.rotation.x = -Math.PI / 2;
  pk.position.set(GL - 8, 0.007, 0);
  scene.add(pk);
  // ゴール 5m × 2.15m
  const postMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  for (const z of [-2.5, 2.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.15, 10), postMat);
    p.position.set(GL, 1.075, z);
    scene.add(p);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.1, 10), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(GL, 2.15, 0);
  scene.add(bar);
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.15, 5, 3, 5, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.35 }),
  );
  net.position.set(GL + 0.72, 1.075, 0);
  scene.add(net);
}

export interface PersonStyle {
  shirt: string;
  shorts: string;
  socks: string;
  number: number | null;
  numColor?: string;
  longSleeve?: boolean;
}

interface Limb {
  sh: THREE.Group;
  el: THREE.Group;
}
interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  ank: THREE.Group;
  sole: THREE.Mesh;
}
export interface Person {
  root: THREE.Group;
  body: THREE.Group;
  armL: Limb;
  armR: Limb;
  legL: Leg;
  legR: Leg;
  blob: THREE.Mesh;
}

function numberTexture(num: number, fg: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = fg;
  g.font = 'bold 84px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(num), 64, 70);
  return srgb(new THREE.CanvasTexture(cv));
}

/** 関節を角度で動かす簡易な人物モデル。スパイクの裏は黄色で目立たせる */
export function makePerson(scene: THREE.Scene, o: PersonStyle): Person {
  const M = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  const shirt = M(o.shirt);
  const shorts = M(o.shorts);
  const socks = M(o.socks);
  const skin = M('#e8b98f');
  const boot = M('#1b1b1b');
  const sole = new THREE.MeshLambertMaterial({ color: '#ffca28', emissive: '#8a6400' });
  const hair = M('#2b1d16');
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = HIP_H;
  root.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 4, 10), shirt);
  torso.position.y = 0.3;
  torso.scale.set(0.78, 1, 1.22);
  body.add(torso);
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.06, 4, 10), shorts);
  pelvis.position.y = 0.04;
  pelvis.scale.set(0.85, 1, 1.25);
  body.add(pelvis);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  head.position.y = 0.66;
  body.add(head);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hair);
  hr.position.y = 0.67;
  hr.rotation.z = 0.25;
  body.add(hr);
  if (o.number != null) {
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: numberTexture(o.number, o.numColor ?? '#fff'), transparent: true }),
    );
    pl.position.set(-0.122, 0.33, 0);
    pl.rotation.y = -Math.PI / 2;
    body.add(pl);
  }
  const limb = (r: number, len: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
    m.position.y = -(len / 2 + r * 0.5);
    return m;
  };
  const mkArm = (side: number): Limb => {
    const sh = new THREE.Group();
    sh.position.set(0, 0.48, side * 0.2);
    body.add(sh);
    sh.add(limb(0.045, 0.19, o.longSleeve ? shirt : skin));
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.06, 4, 8), shirt);
    sleeve.position.y = -0.05;
    sh.add(sleeve);
    const el = new THREE.Group();
    el.position.y = -0.27;
    sh.add(el);
    el.add(limb(0.04, 0.18, skin));
    return { sh, el };
  };
  const mkLeg = (side: number): Leg => {
    const hip = new THREE.Group();
    hip.position.set(0, 0, side * 0.09);
    body.add(hip);
    hip.add(limb(0.068, 0.24, skin));
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.1, 4, 8), shorts);
    sh.position.y = -0.07;
    hip.add(sh);
    const knee = new THREE.Group();
    knee.position.y = -0.36;
    hip.add(knee);
    knee.add(limb(0.052, 0.25, socks));
    const ank = new THREE.Group();
    ank.position.y = -0.36;
    knee.add(ank);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.065, 0.085), boot);
    foot.position.set(0.05, -0.02, 0);
    ank.add(foot);
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.02, 0.1), sole);
    so.position.set(0.05, -0.06, 0);
    ank.add(so);
    return { hip, knee, ank, sole: so };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 20),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  root.add(blob);
  scene.add(root);
  return { root, body, armL, armR, legL, legR, blob };
}

export function applyPose(P: Person, p: Pose): void {
  P.root.position.set(p.x, 0, p.z);
  P.root.rotation.y = p.yaw;
  P.body.position.y = p.y;
  P.body.rotation.z = p.lean;
  P.body.rotation.x = p.roll;
  P.legL.hip.rotation.z = p.hipL;
  P.legL.knee.rotation.z = p.kneeL;
  P.legL.ank.rotation.z = p.ankL;
  P.legR.hip.rotation.z = p.hipR;
  P.legR.knee.rotation.z = p.kneeR;
  P.legR.ank.rotation.z = p.ankR;
  P.armL.sh.rotation.z = p.shL;
  P.armL.sh.rotation.x = p.abL;
  P.armL.el.rotation.z = p.elL;
  P.armR.sh.rotation.z = p.shR;
  P.armR.sh.rotation.x = -p.abR;
  P.armR.el.rotation.z = p.elR;
  // 影は骨盤の真下（寝転ぶと少し前へ）
  P.blob.position.set(Math.sin(-p.lean) * 0.35, 0.01, 0);
}

/**
 * 解説用のラベル（常に手前に表示）。userData.rel は画面の幅に対する大きさの割合で、
 * fitLabels() で視点からの距離に合わせて拡大し、どの視点でも同じくらいの大きさに見せる。
 */
export function makeLabel(text: string, color = '#ffeb3b', rel = 0.3): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.font = 'bold 60px system-ui, sans-serif';
  const w = Math.min(500, g.measureText(text).width + 56);
  g.fillStyle = 'rgba(0,0,0,0.72)';
  const x0 = (512 - w) / 2;
  g.beginPath();
  if (g.roundRect) g.roundRect(x0, 14, w, 100, 30);
  else g.rect(x0, 14, w, 100);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: srgb(new THREE.CanvasTexture(cv)), depthTest: false, transparent: true }));
  sp.renderOrder = 10;
  sp.scale.set(1.6, 0.4, 1);
  sp.userData.rel = rel;
  return sp;
}

export function fitLabels(group: THREE.Object3D, camera: THREE.PerspectiveCamera): void {
  const th = Math.tan((camera.fov * Math.PI) / 360);
  for (const o of group.children) {
    if (!(o instanceof THREE.Sprite)) continue;
    const d = camera.position.distanceTo(o.position);
    const w = 2 * d * th * ((o.userData.rel as number) ?? 0.3) * Math.max(1, 1 / camera.aspect);
    o.scale.set(w, w / 4, 1);
  }
}
