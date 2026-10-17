import type { Nav } from '../App';
import { useUi } from '../app/context';
import { QUESTIONS, RULE_VERSION, SOURCES, STAGES, STAGE_MAP } from '../content';
import type { Stage } from '../content/schema';
import { isInProgress, startStagePatch } from '../engine/session';
import type { AppState } from '../storage/store';

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
  const { store, sound, buzz, confirm } = useUi();
  const count = QUESTIONS.length;
  const inProgress = isInProgress(state);
  const current = inProgress && state.stage ? STAGE_MAP[state.stage] : undefined;

  const start = async (stage: Stage) => {
    sound.unlock();
    if (current && current.id !== stage.id) {
      const ok = await confirm(`「${current.title}」の途中です。「${stage.title}」を始めますか？`, '始める', 'やめる');
      if (!ok) return;
    }
    if (current?.id !== stage.id) store.set((s) => startStagePatch(stage, s));
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
        <p className="eyebrow">JFA 8人制サッカー競技規則・競技規則 {RULE_VERSION}</p>
        <h1>8人制 審判トレーニング</h1>
        <p className="lead">プレーを見て、判定の瞬間に答える練習問題です。保護者審判と4級審判員向け。</p>
        <p className="meta">
          {STAGES.length}ステージ・{count}問
        </p>
      </div>

      <h2 className="sec">ステージを選ぶ</h2>
      <ul className="stages">
        {STAGES.map((st) => {
          const sc = state.stageScores[st.id];
          const now = current?.id === st.id;
          return (
            <li key={st.id}>
              <button type="button" className={`stage-card${now ? ' now' : ''}`} data-stage={st.id} onClick={() => void start(st)}>
                <span className="stage-icon" aria-hidden="true">
                  {st.icon}
                </span>
                <span className="stage-title">{st.title}</span>
                <span className="stage-meta">
                  {now ? `続きから ${state.idx + 1}/${state.order.length}` : sc ? `前回 ${sc.score}/${sc.total}` : `${st.questions.length}問`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
          <b>試験公開中</b>問題と解説は監修前です。実際の判定はJFAの競技規則に従ってください。
        </p>
        <p>
          <b>2026/27改正</b>地域・都道府県の大会では、主催者が適用開始日を決めます（遅くとも2027年4月1日）。「2026/27改正」と表示した問題は、大会要項で確認してください。
        </p>
        <p className="src">
          出典 
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

    </div>
  );
}
