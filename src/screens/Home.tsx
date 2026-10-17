import { useState } from 'react';
import type { Nav } from '../App';
import { useUi } from '../app/context';
import { QUESTIONS, RULE_VERSION, SOURCES, questionsFor } from '../content';
import type { Level } from '../content/schema';
import { LEVEL_CONFIG } from '../engine/levels';
import { isInProgress, startRoundPatch } from '../engine/session';
import type { AppState } from '../storage/store';
import { PitchLogo } from '../ui/PitchLogo';

const LEVEL_KEYS = Object.keys(LEVEL_CONFIG) as Level[];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw" aria-hidden="true" />
    </label>
  );
}

export function Home({ state, nav }: { state: AppState; nav: Nav }) {
  const { store, sound, buzz } = useUi();
  // はじめての方が迷わないよう「入門」を初期選択
  const [sel, setSel] = useState<Level>(state.level ?? 'beginner');
  const L = LEVEL_CONFIG[sel];
  const count = questionsFor(sel).length;
  const inProgress = isInProgress(state);
  const correct = Object.values(state.results).filter((r) => r?.ok).length;

  const start = () => {
    sound.unlock();
    store.set((s) => startRoundPatch(QUESTIONS, s, sel));
    nav.next();
  };
  const setSetting = (key: 'sound' | 'haptics', v: boolean) => {
    store.set((s) => ({ settings: { ...s.settings, [key]: v } }));
    if (key === 'sound' && v) {
      sound.unlock();
      sound.tick();
    }
    if (key === 'haptics' && v) buzz(20);
  };

  return (
    <div className="screen home">
      <div className="hero">
        <PitchLogo />
        <div>
          <h1>
            8人制
            <br />
            審判トレーニング
          </h1>
          <p className="lead">動きを見て、その場で判定。保護者審判と4級審判のための練習クイズです。</p>
        </div>
      </div>
      <div className="chips">
        <span className="chip">競技規則 {RULE_VERSION} 準拠</span>
        <span className="chip">
          {L.label} {count}問・約{Math.max(1, Math.round(count * 0.8))}分
        </span>
        <span className="chip">3D問題あり</span>
      </div>

      {inProgress && state.level && (
        <div className="card resume">
          <div>
            <strong>続きから</strong>
            <span className="muted">
              {'　'}
              {LEVEL_CONFIG[state.level].label}・{state.idx + 1} / {state.order.length}問目
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              sound.unlock();
              nav.next();
            }}
          >
            続ける
          </button>
        </div>
      )}
      {state.finished && state.order.length > 0 && state.level && (
        <div className="card resume">
          <div>
            <strong>前回の結果</strong>
            <span className="muted">
              {'　'}
              {LEVEL_CONFIG[state.level].label}・{correct} / {state.order.length}問正解
            </span>
          </div>
          <button type="button" className="btn ghost" onClick={nav.result}>
            見る
          </button>
        </div>
      )}

      <h2 className="sec">レベルを選ぶ</h2>
      <div className="levels" role="radiogroup" aria-label="レベル">
        {LEVEL_KEYS.map((k) => {
          const c = LEVEL_CONFIG[k];
          return (
            <button
              key={k}
              type="button"
              className={'level-card' + (sel === k ? ' on' : '')}
              role="radio"
              aria-checked={sel === k}
              data-k={k}
              onClick={() => setSel(k)}
            >
              <span className={`lv-badge lv-${k}`}>{c.label}</span>
              <span className="lv-who">{c.who}</span>
              <ul className="lv-points">
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="howto">
        <h2 className="sec">遊び方</h2>
        <ol>
          <li>
            <b>プレーを見る</b>
            <span>先に問いを読んでから再生。判定の瞬間で止まります</span>
          </li>
          <li>
            <b>判定する</b>
            <span>選択肢を選ぶ、または審判や位置をドラッグして「判定する」</span>
          </li>
          <li>
            <b>解説リプレイ</b>
            <span>ラインや距離を重ねて、もう一度再生します</span>
          </li>
        </ol>
      </div>

      <div className="card settings">
        <h2 className="sec">設定</h2>
        <Toggle label="効果音（笛など）" checked={state.settings.sound} onChange={(v) => setSetting('sound', v)} />
        <Toggle label="振動（対応端末のみ）" checked={state.settings.haptics} onChange={(v) => setSetting('haptics', v)} />
      </div>

      <div className="notes">
        <p>
          <b>試験公開中：</b>問題と解説は監修前です。実際の判定はJFAの競技規則に従ってください。
        </p>
        <p>
          <b>2026/27改正：</b>
          地域・都道府県の大会では、主催者が適用開始日を決めます（遅くとも2027年4月1日）。🆕の問題は大会要項で確認しましょう。
        </p>
        <p className="src">
          出典：
          {Object.entries(SOURCES).map(([k, s], i) => (
            <span key={k}>
              {i ? '／' : ''}
              <a href={s.url} target="_blank" rel="noopener">
                {s.label}
              </a>
            </span>
          ))}
        </p>
        <p className="version muted">
          v{__APP_VERSION__}
          {__APP_COMMIT__ ? ` (${__APP_COMMIT__})` : ''} ・{' '}
          <a href="https://github.com/daisuke-awaji/soccer8-referee-quiz" target="_blank" rel="noopener">
            GitHub
          </a>
        </p>
      </div>

      <div className="actionbar">
        <button type="button" className="btn primary big" onClick={start}>
          {L.label}ではじめる
        </button>
      </div>
    </div>
  );
}
