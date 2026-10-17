import { useEffect } from 'react';
import type { Nav } from '../App';
import { useUi } from '../app/context';
import { Icon } from '../ui/Icon';
import { CATEGORIES, QMAP, QUESTIONS } from '../content';
import { LEVEL_CONFIG } from '../engine/levels';
import { resultMessage, startRoundPatch, summarize } from '../engine/session';
import type { AppState } from '../storage/store';

export function buildReport(state: AppState): string {
  const lines = ['【8人制審判トレーニング フィードバック】', `レベル: ${LEVEL_CONFIG[state.level ?? 'beginner'].label}`];
  for (const id of state.order) {
    const r = state.results[id];
    const q = QMAP[id];
    const m = !r ? '未' : r.skipped ? 'スキップ' : r.ok ? '○' : '×';
    const rate = state.ratings[id] === 'hard' ? '（わかりにくい）' : state.ratings[id] === 'good' ? '（わかりやすい）' : '';
    lines.push(`${id} ${q?.title ?? ''}: ${m}${rate}`);
  }
  lines.push(`感想: ${state.notes || '（なし）'}`);
  lines.push(`版: v${__APP_VERSION__}${__APP_COMMIT__ ? ` (${__APP_COMMIT__})` : ''}`);
  lines.push(`端末: ${navigator.userAgent}`);
  return lines.join('\n');
}

export function Result({ state, nav }: { state: AppState; nav: Nav }) {
  const { store, sound, buzz, toast } = useUi();
  const level = state.level ?? 'beginner';
  const sum = summarize(state.order, state.results, QMAP);

  useEffect(() => {
    if (sum.ratio >= 0.9 && sum.total) {
      sound.good();
      buzz([20, 40, 20]);
    }
    // 結果画面を開いたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    const text = buildReport(state);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast('コピーしました');
        return;
      }
    } catch {
      /* 下の方法で試す */
    }
    const ta = document.createElement('textarea');
    ta.style.cssText = 'position:fixed;opacity:0';
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('コピーしました');
    } catch {
      toast('コピーできませんでした');
    }
    ta.remove();
  };
  const restart = (ids?: string[], round: AppState['round'] = 'main') => {
    store.set((s) => startRoundPatch(QUESTIONS, s, level, ids, round));
    nav.next();
  };

  return (
    <div className="screen result">
      <header className="qbar plain">
        <button type="button" className="icon-btn" aria-label="ホームへ" onClick={nav.home}>
          <Icon name="close" />
        </button>
        <span className="count">結果</span>
      </header>
      <main className="qmain">
        <div className="score">
          <p className="score-lv">{LEVEL_CONFIG[level].label}・正解数</p>
          <div className="score-num">
            <strong>{sum.score}</strong>
            <span>/ {sum.total}</span>
          </div>
          <div className="score-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(sum.ratio * 100)}%` }} />
          </div>
          <p className="score-msg">{resultMessage(sum.ratio)}</p>
        </div>

        {sum.categories.length > 0 && (
          <div className="card">
            <h2 className="sec">分野別</h2>
            {sum.categories.map((c) => (
              <div className="cat-row" key={c.category}>
                <span className="cat-name">{CATEGORIES[c.category]}</span>
                <span className="bar">
                  <i style={{ width: `${Math.round((c.ok / c.n) * 100)}%` }} />
                </span>
                <span className="cat-num">
                  {c.ok}/{c.n}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h2 className="sec">問題ごとの結果</h2>
          <ul className="res-list">
            {state.order.map((id) => {
              const q = QMAP[id];
              if (!q) return null;
              const r = state.results[id];
              const mk = !r || r.skipped ? '–' : r.ok ? '○' : r.n ? '△' : '×';
              const cls = !r || r.skipped ? 'skip' : r.ok ? 'ok' : 'ng';
              return (
                <li key={id} className={cls}>
                  <span className="mk">{mk}</span>
                  <span className="rt">
                    <b>{q.title}</b>
                    <small>
                      {CATEGORIES[q.category]}
                      {r && (r.total ?? 0) > 1 ? `・${r.n}/${r.total}` : ''}
                      {r?.hint ? '・ヒント使用' : ''}
                    </small>
                  </span>
                  <button type="button" className="btn ghost sm" onClick={() => nav.review(id)}>
                    もう一度
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card tester">
          <h2 className="sec">テスターの方へ</h2>
          <p className="muted">改善に使います。気づいたことを書いて「結果と感想をコピー」を押し、LINEやメールで送ってください。</p>
          <textarea
            className="notes-input"
            rows={3}
            placeholder="気づいたこと（例：○問目の動きが速すぎた、言葉が難しかった など）"
            value={state.notes}
            onChange={(e) => store.set({ notes: e.target.value })}
          />
          <button type="button" className="btn ghost" onClick={copy}>
            結果と感想をコピー
          </button>
        </div>

        <div className="res-actions">
          {sum.wrong.length > 0 && (
            <button type="button" className="btn primary" onClick={() => restart(sum.wrong, 'retry')}>
              間違えた問題をもう一度（{sum.wrong.length}問）
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => restart()}>
            最初からやり直す
          </button>
          <button type="button" className="btn ghost" onClick={nav.home}>
            レベルを変える
          </button>
        </div>
      </main>
    </div>
  );
}
