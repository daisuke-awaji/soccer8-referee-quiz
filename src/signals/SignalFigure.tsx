/** 合図の絵（SVG）。形は poses.ts、問題データでは figure: {pose, mirror, left, right} で指定する */
import type { SignalFigure as Fig } from '../content/schema';
import { GROUND_Y, POSES, VIEW_H, VIEW_W, VIEW_X, VIEW_Y, flagStick, hands, isAssistantPose, pointedSpot, shoulders, step, type Pt } from './poses';

const INK = '#222';
const BACK = '#8a8a8a';
const pts = (a: ReadonlyArray<Pt>) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

function Flag({ from, to, dir, both, wave }: { from: Pt; to: Pt; dir: number; both: boolean; wave: boolean }) {
  // 棒（両手で持つときは、両手の外まで伸ばす）
  const a: Pt = both ? [from[0] - 8, from[1]] : from;
  const b: Pt = both ? [to[0] + 8, to[1]] : to;
  // 布は棒の先に付ける。向きは棒に垂直（両手のときは下に垂らす）
  const back = step(b, dir + 180, 12);
  const perp = both ? -90 : dir + 90;
  const c1 = step(back, perp, 9);
  const c2 = step(b, perp, 9);
  const mid: Pt = [(b[0] + c1[0]) / 2, (b[1] + c1[1]) / 2];
  return (
    <g className="sig-flag">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#9e9e9e" strokeWidth={1.8} strokeLinecap="round" />
      <polygon points={pts([b, back, c1, c2])} fill="#ffd600" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={pts([b, c1, c2])} fill="#e53935" />
      {wave && (
        <g fill="none" stroke={BACK} strokeWidth={1.4} strokeLinecap="round">
          <path d={`M ${mid[0] - 14} ${mid[1] - 7} q -5 7 0 14`} />
          <path d={`M ${mid[0] - 19} ${mid[1] - 9} q -6 9 0 18`} />
          <path d={`M ${mid[0] + 14} ${mid[1] - 7} q 5 7 0 14`} />
          <path d={`M ${mid[0] + 19} ${mid[1] - 9} q 6 9 0 18`} />
        </g>
      )}
    </g>
  );
}

function Hand({ at, dir, open }: { at: Pt; dir: number; open?: boolean }) {
  return (
    <g>
      {open &&
        [-36, -18, 0, 18, 36].map((d) => {
          const tip = step(at, dir + d, 7.5);
          return <line key={d} x1={at[0]} y1={at[1]} x2={tip[0]} y2={tip[1]} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />;
        })}
      <circle cx={at[0]} cy={at[1]} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

export function SignalFigure({ figure, size = 'lg' }: { figure: Fig; size?: 'lg' | 'sm' }) {
  const shape = POSES[figure.pose];
  const sh = shoulders(shape);
  const hd = hands(shape);
  const flag = flagStick(shape);
  const spot = pointedSpot(shape);
  const side = !!shape.side;
  const arm = (from: Pt, to: Pt, color: string) => (
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeWidth={6} strokeLinecap="round" />
  );
  const backArm = side ? arm(sh.L, hd.L, BACK) : null;
  const who = isAssistantPose(figure.pose) ? '副審' : '主審';

  return (
    <span className={'sig sig-' + size}>
      <svg viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`${who}の合図の絵`} className="sig-svg">
        <line x1={VIEW_X + 6} y1={GROUND_Y} x2={VIEW_X + VIEW_W - 6} y2={GROUND_Y} stroke="#d4d4d4" strokeWidth={1.2} />
        <g transform={figure.mirror ? `matrix(-1 0 0 1 120 0)` : undefined}>
          {spot && (
            <>
              <line x1={hd.R[0]} y1={hd.R[1]} x2={spot[0]} y2={spot[1] - 3} stroke={BACK} strokeWidth={1.2} strokeDasharray="2.5 2.5" />
              <ellipse cx={spot[0]} cy={spot[1]} rx={4} ry={1.8} fill="#fff" stroke={INK} strokeWidth={1.3} />
            </>
          )}
          {backArm}
          {side && shape.flag === 'L' && flag && <Flag {...flag} both={false} wave={!!shape.wave} />}
          {/* 脚 */}
          <g stroke={INK} strokeWidth={7} strokeLinecap="round">
            <line x1={side ? 58 : 55} y1={86} x2={53} y2={121} />
            <line x1={side ? 62 : 65} y1={86} x2={67} y2={121} />
          </g>
          {/* 胴・パンツ */}
          <rect x={side ? 54 : 50} y={72} width={side ? 12 : 20} height={16} rx={2} fill="#4a4a4a" />
          <polygon points={side ? '54,33 66,33 65,75 55,75' : '46,33 74,33 70,75 50,75'} fill={INK} />
          {/* 頭（横向きは鼻で向きを示す） */}
          <circle cx={60} cy={21} r={9} fill="#fff" stroke={INK} strokeWidth={2} />
          {side && <polygon points="68.4,18 72.5,22 68.4,24" fill={INK} />}
          {!side && arm(sh.L, hd.L, INK)}
          {arm(sh.R, hd.R, INK)}
          {flag && !(side && shape.flag === 'L') && <Flag {...flag} both={shape.flag === 'both'} wave={!!shape.wave} />}
          <Hand at={hd.L} dir={shape.armL.dir} />
          <Hand at={hd.R} dir={shape.armR.dir} open={shape.openHand} />
        </g>
      </svg>
      {(figure.left || figure.right) && (
        <span className="sig-dir">
          <span>{figure.left ? `← ${figure.left}` : ''}</span>
          <span>{figure.right ? `${figure.right} →` : ''}</span>
        </span>
      )}
    </span>
  );
}
