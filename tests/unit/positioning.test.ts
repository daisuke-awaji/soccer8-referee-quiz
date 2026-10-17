/**
 * 立ち位置の問題（H-04）：候補ごとの見え方の判定が、問題データの正解・解説と合っていること。
 * あわせて、判定に使う簡単な形（円柱）が、実際に描く3Dの人物と同じ結果になることを確かめる。
 */
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugins/content';
import type { PositionStep } from '../../src/content/schema';
import * as M from '../../src/scene3d/scenes/penaltyAreaPushMotion';

const { bundle } = loadContent();
const q = bundle.questions.find((x) => x.id === 'H-04')!;
const step = q.steps[0] as PositionStep;
const check = (id: string) => M.viewCheck(M.fieldTo3D(step.candidates.find((c) => c.id === id)!.at));

describe('H-04 立ち位置ごとの見え方', () => {
  it('3つの条件をすべて満たすのは、正解の候補だけ', () => {
    const ok = step.candidates.filter((c) => M.viewOk(M.viewCheck(M.fieldTo3D(c.at)))).map((c) => c.id);
    expect(ok).toEqual([step.answer]);
  });
  it('A（副審と同じ側）：押した手は見えるが、副審が視野に入らない', () => {
    expect(check('A')).toMatchObject({ handsVisible: true, arInView: false, clearOfPlay: true });
  });
  it('B（プレーの真後ろ）：押した手が青3番の背中に隠れる', () => {
    expect(check('B').handsVisible).toBe(false);
  });
  it('D（プレーのすぐそば）：ボールのコースに入る', () => {
    expect(check('D').clearOfPlay).toBe(false);
  });
  it('C（正解）：副審は、見ている方向から視野の内側にいる', () => {
    expect(check('C').arAngle).toBeLessThan(M.VIEW_HALF_DEG - 5);
  });
  it('副審は、後方から2人目の守備側競技者（青3番）のラインにいる', () => {
    expect(M.arAt(M.CONTACT_T).x).toBeCloseTo(M.b3At(M.CONTACT_T).x, 5);
  });
});

describe('H-04 判定の形は、描く3Dの人物と合っている', () => {
  // kit.ts は背番号の文字を canvas で描くので、node ではその部分だけ空の canvas にする
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => {}) });
    (globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  });
  it('候補の目の高さから両手まで、ほかの人物の体に当たるかどうかが一致する', async () => {
    const { applyPose, makePerson } = await import('../../src/scene3d/kit');
    const scene = new THREE.Scene();
    const style = { shirt: '#f00', shorts: '#fff', socks: '#f00', number: 1 };
    const T = M.CONTACT_T;
    const make = (f: (t: number) => ReturnType<typeof M.poseB3>) => {
      const p = makePerson(scene, style);
      applyPose(p, f(T));
      return p;
    };
    const b3 = make(M.poseB3);
    b3.armL.sh.rotation.y = -M.PUSH_ARM_YAW * M.pushK(T);
    b3.armR.sh.rotation.y = M.PUSH_ARM_YAW * M.pushK(T);
    [M.poseR9, M.poseR7, M.poseB2, M.poseR11, M.poseB5, M.poseGK].forEach(make);
    scene.updateMatrixWorld(true);
    const hands = [b3.armL, b3.armR].map((a) => a.el.localToWorld(new THREE.Vector3(0, -0.22, 0)));
    const own = new Set<THREE.Object3D>();
    [b3.armL.el, b3.armR.el].forEach((e) => e.traverse((o) => own.add(o)));
    const solids: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !own.has(o) && m.geometry.type !== 'CircleGeometry') solids.push(o);
    });
    const rc = new THREE.Raycaster();
    for (const c of step.candidates) {
      const e = M.fieldTo3D(c.at);
      const eye = new THREE.Vector3(e.x, M.EYE_H, e.z);
      const seen = hands.some((h) => {
        const d = h.clone().sub(eye);
        rc.set(eye, d.clone().normalize());
        rc.far = d.length() - 0.03;
        return rc.intersectObjects(solids, false).length === 0;
      });
      expect([c.id, seen]).toEqual([c.id, M.viewCheck(e).handsVisible]);
    }
  });
});
