/**
 * 問題画面。流れ: 問いを読む → 再生（判定の瞬間で停止）→ 回答 → 解説リプレイ。
 * 2D（SVG）・3D（three.js）の再生エンジンは命令的に操作し、React は問い・選択肢・解説を描く。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Nav } from '../App';
import { useUi } from '../app/context';
import { CATEGORIES, QMAP, SOURCES } from '../content';
import type { ChoiceStep, Question, Step, Vec2 } from '../content/schema';
import { LEVEL_CONFIG, hasAnimation, stepsFor } from '../engine/levels';
import { judgePlacement, type PlacementJudgement } from '../engine/placement';
import type { StageEngine } from '../engine/stage';
import { Pitch2D } from '../pitch2d/Pitch2D';
import { CAMERAS, createScene3D, preloadScene3D, type CameraId, type Scene3DEngine } from '../scene3d';
import type { AppState } from '../storage/store';
import { Icon } from '../ui/Icon';
import { RichText } from '../ui/RichText';

type Phase = 'loading' | 'intro' | 'watching' | 'answering' | 'stepResult' | 'feedback' | 'error';

interface StepResult {
  ok: boolean;
  pick: string | Vec2 | null;
  placement?: PlacementJudgement;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Legend({ is3d }: { is3d: boolean }) {
  const dot = (cls: string, label: string) => (
    <span className="lg" key={cls}>
      <i className={'dot ' + cls} />
      {label}
    </span>
  );
  return (
    <div className="legend">
      {is3d
        ? [dot('d-red', '赤10番（攻撃）'), dot('d-blue', '青4番（守備）'), dot('d-gk', 'GK'), dot('d-ref', '黒＝審判'), dot('d-sole', '黄色＝スパイクの裏')]
        : [
            dot('d-red', '赤チーム（↑へ攻撃）'),
            dot('d-blue', '青チーム'),
            dot('d-gk', '青GK'),
            dot('d-ref', '主＝主審 / 副＝副審 / 4＝第4の審判員'),
            dot('d-ball', 'ボール'),
            dot('d-sub', '点線＝交代要員'),
          ]}
    </div>
  );
}

export function Quiz({ question: q, review, state, nav }: { question: Question; review: boolean; state: AppState; nav: Nav }) {
  const { store, sound, buzz, toast, confirm } = useUi();
  const level = state.level ?? 'beginner';
  const L = LEVEL_CONFIG[level];
  const steps = useMemo(() => stepsFor(q, level), [q, level]);
  const is3d = q.kind === '3d';
  const hasAnim = hasAnimation(q);
  const hasStage = q.kind !== 'text';
  const pauseAt = q.kind === '3d' ? q.scene3d.pauseAt : q.kind === '2d' ? q.scene.pauseAt : 0;
  const endAt = q.kind === '3d' ? q.scene3d.endAt : q.kind === '2d' ? (q.scene.endAt ?? q.scene.pauseAt) : 0;

  const [phase, setPhaseState] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [stepIdx, setStepIdx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [place, setPlace] = useState<Vec2 | null>(null);
  const [res, setRes] = useState<StepResult[]>([]);
  const [views, setViews] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [hintOpen, setHintOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [cam, setCam] = useState<CameraId>('referee');
  const [camsUnlocked, setCamsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StageEngine | null>(null);
  const placementOn = useRef<number | null>(null);

  const step: Step = steps[stepIdx]!;
  const submitted = res.length > stepIdx;
  const isFeedback = phase === 'feedback';
  const engine2d = () => (engineRef.current?.kind === '2d' ? (engineRef.current as Pitch2D) : null);
  const engine3d = () => (engineRef.current?.kind === '3d' ? (engineRef.current as Scene3DEngine) : null);
  const setProg = (k: number) => {
    if (progRef.current) progRef.current.style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%';
  };

  /* ---------- エンジンの用意 */
  useEffect(() => {
    let cancelled = false;
    const ready = () => setPhase(hasAnim ? 'intro' : 'answering');
    if (q.kind === 'text') {
      ready();
      return;
    }
    const box = stageRef.current!;
    if (q.kind === '2d') {
      engineRef.current = new Pitch2D(box, q.scene, {
        onCaption: setCaption,
        onEvent: (ev) => {
          if (ev.type === 'whistle') sound.whistle();
          else if (ev.type === 'tick') sound.tick();
        },
        onProgress: setProg,
      });
      ready();
    } else {
      setPhase('loading');
      const caps = q.scene3d.captions;
      createScene3D(box, q.scene3d, {
        onProgress: setProg,
        onTime: (t) => {
          let c = '';
          for (const x of caps) if (x.t <= t + 1e-6) c = x.text;
          setCaption(c);
        },
      })
        .then((e) => {
          if (cancelled) {
            e.destroy();
            return;
          }
          engineRef.current = e;
          ready();
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.warn(err);
          const msg = String((err as Error)?.message ?? err);
          setError(msg);
          setPhase('error');
        });
    }
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      placementOn.current = null;
    };
  }, [q, hasAnim, retryKey, sound, setPhase]);

  // タイトルへフォーカス（読み上げ対応）
  useEffect(() => {
    const id = setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(id);
  }, []);

  // 次の問題が3Dなら先読み
  useEffect(() => {
    const s = store.get();
    for (let i = s.idx; i < Math.min(s.order.length, s.idx + 3); i++) {
      const nq = QMAP[s.order[i]!];
      if (nq?.kind === '3d') {
        preloadScene3D(nq.scene3d.id);
        return;
      }
    }
  }, [store, phase]);

  /* ---------- 配置問題：回答の時だけドラッグできる */
  useEffect(() => {
    const e = engine2d();
    if (phase !== 'answering' || step.type !== 'placement' || !e) return;
    if (placementOn.current === stepIdx) return;
    placementOn.current = stepIdx;
    e.enablePlacement(step.placement, (p) => setPlace(p));
  }, [phase, step, stepIdx]);

  // 選択肢が出たら見える位置へ
  useEffect(() => {
    if (phase !== 'answering' || step.type !== 'choice') return;
    const id = setTimeout(() => panelRef.current?.querySelector('.choices')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    return () => clearTimeout(id);
  }, [phase, step]);

  /* ---------- 再生 */
  const left = L.replays === Infinity ? Infinity : L.replays - (views - 1);
  const watch = () => {
    const e = engineRef.current;
    if (!e) return;
    sound.unlock();
    setViews((v) => v + 1);
    setFrozen(false);
    if (phaseRef.current !== 'answering') setPhase('watching');
    e.play({
      from: 0,
      to: pauseAt,
      speed,
      onEnd: () => {
        setFrozen(true);
        if (phaseRef.current === 'watching') setPhase('answering');
      },
    });
  };
  const playExplain = (sp = speed) => {
    const e = engineRef.current;
    if (!e) return;
    setFrozen(false);
    if (hasAnim) e.play({ from: 0, to: endAt, speed: sp });
  };
  const replay = () => {
    if (isFeedback) playExplain();
    else if (left > 0) watch();
  };
  const toggleSpeed = () => {
    const seq = is3d ? [1, 0.5, 0.25] : [1, 0.5];
    const nx = seq[(seq.indexOf(speed) + 1) % seq.length]!;
    setSpeed(nx);
    toast(nx === 1 ? '通常の速さ' : `${nx}倍のスロー再生`);
  };

  /* ---------- 判定 */
  const submit = () => {
    if (submitted) return;
    let r: StepResult;
    if (step.type === 'choice') {
      r = { ok: sel === step.answer, pick: sel };
    } else {
      const j = judgePlacement(step.placement, place!);
      r = { ok: j.ok, pick: place, placement: j };
      const e = engine2d();
      e?.disablePlacement();
      e?.showPlacementResult(place, step.placement, j.ok);
    }
    const all = [...res, r];
    setRes(all);
    if (r.ok) {
      sound.good();
      buzz(18);
    } else {
      sound.bad();
      buzz([30, 50, 30]);
    }
    if (stepIdx < steps.length - 1) setPhase('stepResult');
    else enterFeedback(all);
  };

  const enterFeedback = (all: StepResult[]) => {
    const nOk = all.filter((x) => x.ok).length;
    const okAll = nOk === steps.length;
    if (!review) {
      store.set((s) => ({
        results: { ...s.results, [q.id]: { ok: okAll, n: nOk, total: steps.length, hint: hintOpen, views, at: Date.now() } },
      }));
    }
    setPhase('feedback');
    const e3 = engine3d();
    const e2 = engine2d();
    if (e3) {
      e3.setAnalysis(true);
      setCamsUnlocked(true);
      setCam('side');
      e3.setCamera('side', true);
      setSpeed(0.5);
      playExplain(0.5);
    } else if (e2) {
      e2.setOverlays(q.explain.overlays);
      if (hasAnim) playExplain();
      else e2.seek(0);
    }
  };

  // 解説に入ったら、判定の見出しが見えるところまでスクロール
  useLayoutEffect(() => {
    if (phase !== 'feedback') return;
    requestAnimationFrame(() => {
      const head = document.querySelector('.qbar') as HTMLElement | null;
      const wrap = stageWrapRef.current;
      const sticky = wrap && getComputedStyle(wrap).position === 'sticky' ? wrap.offsetHeight : 0;
      const off = (head?.offsetHeight ?? 0) + sticky + 8;
      const v = verdictRef.current;
      if (!v) return;
      const y = v.getBoundingClientRect().top + window.scrollY - off;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  }, [phase]);

  const nextStep = () => {
    setStepIdx((i) => i + 1);
    setSel(null);
    setPhase('answering');
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const goNext = () => {
    if (review) {
      nav.result();
      return;
    }
    store.set((s) => ({ idx: s.idx + 1 }));
    nav.next();
  };
  const skip = () => {
    store.set((s) => ({ results: { ...s.results, [q.id]: { skipped: true, at: Date.now() } }, idx: s.idx + 1 }));
    nav.next();
  };
  const quit = async () => {
    if (review) {
      nav.result();
      return;
    }
    if (await confirm('中断してホームに戻りますか？ 進み具合は保存されます。', 'ホームへ', '続ける')) nav.home();
  };
  const pickCam = (id: CameraId) => {
    if (!camsUnlocked && id !== 'referee') {
      toast('解答したあとに、ほかの視点で見られます');
      return;
    }
    setCam(id);
    engine3d()?.setCamera(id, true);
  };

  /* ---------- 表示 */
  const isLast = state.idx >= state.order.length - 1;
  let action: { label: string; disabled: boolean; onClick?: () => void } | null;
  switch (phase) {
    case 'loading':
      action = { label: '読み込み中', disabled: true };
      break;
    case 'intro':
      action = { label: 'プレーを見る', disabled: false, onClick: watch };
      break;
    case 'watching':
      action = { label: '再生中', disabled: true };
      break;
    case 'answering': {
      const ok = step.type === 'placement' ? !!place : !!sel;
      action = {
        label: ok ? '判定する' : step.type === 'placement' ? '位置を決めてください' : '選択肢を選んでください',
        disabled: !ok,
        onClick: submit,
      };
      break;
    }
    case 'stepResult':
      action = { label: '次の質問へ', disabled: false, onClick: nextStep };
      break;
    case 'feedback':
      action = { label: review ? '結果に戻る' : isLast ? '結果を見る' : '次の問題へ', disabled: false, onClick: goNext };
      break;
    case 'error':
      action = null;
  }

  const hasRed = q.kind === '2d' && q.scene.actors.some((a) => a.team === 'red' && a.role !== 'substitute');
  const hasCaptions =
    q.kind === '3d'
      ? q.scene3d.captions.length > 0
      : q.kind === '2d' && q.scene.timeline.some((k) => (k.events ?? []).some((e) => e.type === 'caption'));
  const showTools = hasStage && (hasAnim || isFeedback);
  const replayLabel = isFeedback
    ? '解説リプレイ'
    : left === Infinity
      ? 'もう一度見る'
      : left > 0
        ? `もう一度見る（残り${left}回）`
        : '見直しは1回まで';
  const replayDisabled = !isFeedback && (phase === 'intro' || phase === 'watching' || phase === 'loading' || left <= 0);
  const nOk = res.filter((r) => r.ok).length;
  const okAll = nOk === steps.length;
  const showChoices = phase === 'answering' || phase === 'stepResult' || phase === 'feedback';
  const noGL = /WebGL/i.test(error ?? '');

  return (
    <div className={'screen quiz' + (is3d ? ' is3d' : '') + (hasStage ? '' : ' is-text')}>
      <header className="qbar">
        <button type="button" className="icon-btn" aria-label={review ? '結果に戻る' : '中断する'} onClick={quit}>
          <Icon name="close" />
        </button>
        <div className="segs" aria-hidden="true">
          {state.order.map((id, i) => {
            const r = state.results[id];
            let cls = 'seg';
            if (!review && i === state.idx && !(isFeedback && r)) cls += ' now';
            else if (r?.skipped) cls += ' skip';
            else if (r) cls += r.ok ? ' ok' : ' ng';
            return <i key={id + i} className={cls} />;
          })}
        </div>
        <span className="count">{review ? '復習' : `${state.idx + 1} / ${state.order.length}`}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="効果音の切り替え"
          aria-pressed={state.settings.sound}
          onClick={() => {
            const v = !state.settings.sound;
            store.set((s) => ({ settings: { ...s.settings, sound: v } }));
            if (v) sound.unlock();
          }}
        >
          <Icon name={state.settings.sound ? 'soundOn' : 'soundOff'} />
        </button>
      </header>

      <main className="qmain">
        <div className="qmeta">
          <span className="chip">{CATEGORIES[q.category]}</span>
          {q.badges.includes('new2026') && <span className="chip">2026/27改正</span>}
          {q.badges.includes('provisional') && <span className="chip chip-warn">一部 監修前</span>}
          <span className="chip chip-lv">{L.label}</span>
        </div>
        <h2 className="qtitle" tabIndex={-1} ref={titleRef}>
          {q.title}
        </h2>

        {hasStage && (
          <div className={'stage-wrap' + (isFeedback ? ' sticky' : '')} ref={stageWrapRef}>
            <div className="stage-box">
              <div className={'stage' + (is3d ? ' stage-3d' : '')} ref={stageRef} key={retryKey} />
              {phase === 'loading' && (
                <div className="loader">
                  <span className="spin" />
                  3Dを読み込み中
                </div>
              )}
              {phase === 'error' && (
                <div className="loader fail">
                  <p>
                    {noGL
                      ? 'この端末・ブラウザでは3D表示が使えないようです。別のブラウザ（Chrome / Safari の最新版）でお試しください。'
                      : '3Dを読み込めませんでした。通信環境を確認して、もう一度お試しください。'}
                  </p>
                  <small className="err-detail">詳細: {(error ?? '').slice(0, 160)}</small>
                  <div className="row">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setError(null);
                        setRetryKey((k) => k + 1);
                      }}
                    >
                      再試行
                    </button>
                    {!review && (
                      <button type="button" className="btn ghost" onClick={skip}>
                        この問題をとばす
                      </button>
                    )}
                  </div>
                </div>
              )}
              {hasRed && !isFeedback && (
                <div className="dir-chip" aria-hidden="true">
                  赤の攻撃 ↑
                </div>
              )}
              <div className="stage-badge" hidden={!frozen || isFeedback}>
                判定の瞬間
              </div>
              <button type="button" className="stage-play" aria-label="プレーを再生する" hidden={phase !== 'intro'} onClick={watch}>
                <span className="lbl">
                  <Icon name="play" />
                  プレーを見る
                </span>
              </button>
            </div>
            <div className={'stage-caption' + (hasCaptions ? '' : ' none') + (caption ? ' show' : '')} aria-live="polite">
              {caption}
            </div>
            <div className="stage-progress">
              <i ref={progRef} />
            </div>
          </div>
        )}

        {is3d && phase !== 'error' && phase !== 'loading' && (
          <div className="cam-tabs" role="tablist" aria-label="視点">
            {CAMERAS.map((c) => {
              const locked = !camsUnlocked && c.id !== 'referee';
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  className={'cam' + (cam === c.id ? ' on' : '') + (locked ? ' locked' : '')}
                  data-id={c.id}
                  aria-selected={cam === c.id}
                  onClick={() => pickCam(c.id)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="stage-tools" hidden={!showTools || phase === 'error'}>
          {hasAnim && (
            <button type="button" className="tool" disabled={replayDisabled} onClick={replay}>
              {replayLabel}
            </button>
          )}
          {hasAnim && (isFeedback || L.slow) && (
            <button type="button" className="tool" aria-pressed={speed < 1} onClick={toggleSpeed}>
              {speed === 1 ? 'スロー' : `${speed}倍`}
            </button>
          )}
          {is3d && isFeedback && (
            <button
              type="button"
              className="tool"
              onClick={() => {
                const e = engine3d();
                if (!e) return;
                e.seek(e.contactAt);
                setProg(e.contactAt / endAt);
              }}
            >
              接触の瞬間
            </button>
          )}
          <button type="button" className="tool" aria-expanded={legendOpen} onClick={() => setLegendOpen((v) => !v)}>
            凡例
          </button>
        </div>
        {legendOpen && <Legend is3d={is3d} />}

        <section className="panel" ref={panelRef}>
          {phase !== 'error' && (
            <>
              {steps.length > 1 && (
                <div className="step-no">
                  質問 {stepIdx + 1} / {steps.length}
                </div>
              )}
              {stepIdx > 0 && (
                <ol className="step-hist">
                  {res.slice(0, stepIdx).map((r, i) => {
                    const s = steps[i]!;
                    const t = s.type === 'placement' ? '位置' : (s.choices.find((c) => c.id === r.pick)?.text ?? '');
                    return (
                      <li key={i} className={r.ok ? 'ok' : 'ng'}>
                        <span className="mk">{r.ok ? '○' : '×'}</span>
                        <span>{t}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="prompt">
                <RichText text={step.question} />
              </p>
              {L.hints && q.hint && stepIdx === 0 && !review && !submitted && (
                <>
                  {!hintOpen && (
                    <button type="button" className="link-btn" onClick={() => setHintOpen(true)}>
                      ヒントを見る
                    </button>
                  )}
                  {hintOpen && (
                    <p className="hint">
                      <b>ヒント</b>
                      {q.hint}
                    </p>
                  )}
                </>
              )}
              {!showChoices && hasAnim && (
                <p className="muted wait">問いを読んでから、プレーを再生してください。判定の瞬間で止まり、選択肢が出ます。</p>
              )}
              {showChoices && step.type === 'choice' && (
                <ChoiceList step={step} sel={sel} result={submitted ? res[stepIdx]! : null} onPick={(id) => {
                  setSel(id);
                  buzz(8);
                }} />
              )}
              {showChoices && step.type === 'placement' && !submitted && (
                <p className="place-help">
                  {step.placement.mode === 'line'
                    ? '副審をタッチラインに沿って上下にドラッグします。ピッチをタップしても動かせます。'
                    : 'ピッチをタップして置き、ドラッグで微調整できます。'}
                </p>
              )}
              {submitted && res[stepIdx]?.placement && (
                <div className={'place-fb ' + (res[stepIdx]!.ok ? 'ok' : 'ng')}>
                  <p className="desc">{res[stepIdx]!.placement!.desc}</p>
                  {res[stepIdx]!.placement!.note && <p>{res[stepIdx]!.placement!.note}</p>}
                </div>
              )}
              {submitted && !(isFeedback && steps.length === 1) && (
                <p className={'verdict-mini ' + (res[stepIdx]!.ok ? 'ok' : 'ng')} role="status">
                  {res[stepIdx]!.ok ? '正解' : '不正解'}
                </p>
              )}
            </>
          )}

          {isFeedback && (
            <div className="explain">
              <div className={'verdict ' + (okAll ? 'ok' : nOk ? 'part' : 'ng')} ref={verdictRef}>
                {okAll ? '正解' : nOk > 0 ? `${steps.length}問中 ${nOk}問 正解` : '不正解'}
              </div>
              <p className="ex-sum">
                <RichText text={q.explain.summary} />
              </p>
              {is3d && <p className="ex-tip">上の視点を「副審の位置」「真横」に切り替えると、見え方の違いを確かめられます。</p>}
              {q.explain.detail && (
                <details className="ex-detail" open>
                  <summary>くわしい解説</summary>
                  <p>
                    <RichText text={q.explain.detail} />
                  </p>
                </details>
              )}
              {q.badges.includes('new2026') && (
                <p className="notice new">
                  <b>2026/27改正</b>
                  地域・都道府県の大会では、まだ2025/26版を使っている場合があります（遅くとも2027年4月1日までに適用）。大会要項で確認してください。
                </p>
              )}
              {q.badges.includes('provisional') && (
                <p className="notice warn">
                  <b>監修前の暫定解答</b>
                  {q.review.note ?? '一部の判断は、監修者の確認後に確定します。'}
                </p>
              )}
              <div className="refs">
                <h3 className="sec">根拠</h3>
                {q.refs.map((r) => (
                  <a key={r.src + r.article} className="ref" href={SOURCES[r.src]?.url} target="_blank" rel="noopener">
                    <span>{r.article}</span>
                    <small>{SOURCES[r.src]?.label}</small>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <div className="actionbar">
        {action && (
          <button type="button" className="btn primary big" disabled={action.disabled} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function ChoiceList({
  step,
  sel,
  result,
  onPick,
}: {
  step: ChoiceStep;
  sel: string | null;
  result: StepResult | null;
  onPick: (id: string) => void;
}) {
  const done = !!result;
  return (
    <div className="choices" role="radiogroup" aria-label="選択肢">
      {step.choices.map((c, i) => {
        let cls = 'choice';
        if (!done && sel === c.id) cls += ' sel';
        if (done) {
          if (c.id === step.answer) cls += ' is-correct';
          else if (c.id === result.pick) cls += ' is-wrong';
          else cls += ' is-dim';
        }
        const wrongPick = done && c.id === result.pick && c.id !== step.answer;
        return (
          <FragmentWithFeedback key={c.id} feedback={wrongPick ? c.feedback : undefined}>
            <button
              type="button"
              className={cls}
              role="radio"
              aria-checked={sel === c.id}
              data-id={c.id}
              disabled={done}
              onClick={() => !done && onPick(c.id)}
            >
              <span className="letter">{LETTERS[i]}</span>
              <span className="ctext">
                <RichText text={c.text} />
              </span>
              {done && c.note && <span className="cnote">{c.note}</span>}
              {done && c.id === step.answer && <span className="mark">正解</span>}
              {wrongPick && <span className="mark">あなたの回答</span>}
            </button>
          </FragmentWithFeedback>
        );
      })}
    </div>
  );
}

function FragmentWithFeedback({ feedback, children }: { feedback?: string; children: ReactNode }) {
  return (
    <>
      {children}
      {feedback && (
        <p className="choice-fb">
          <RichText text={feedback} />
        </p>
      )}
    </>
  );
}
