/** 画面をまたいで使うもの（保存・効果音・振動・トースト・用語の説明・確認ダイアログ） */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY } from '../content';
import { createHaptics, createSound, type Sound } from '../audio/feedback';
import type { Store } from '../storage/store';

interface Ui {
  store: Store;
  sound: Sound;
  buzz: (p: number | number[]) => void;
  toast: (msg: string) => void;
  showGloss: (term: string) => void;
  confirm: (msg: string, ok: string, cancel: string) => Promise<boolean>;
}

const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const v = useContext(UiContext);
  if (!v) throw new Error('UiProvider がありません');
  return v;
}

interface ConfirmState {
  msg: string;
  ok: string;
  cancel: string;
  resolve: (v: boolean) => void;
}

export function UiProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; show: boolean }>>([]);
  const [gloss, setGloss] = useState<string | null>(null);
  const [confirmState, setConfirm] = useState<ConfirmState | null>(null);
  const nextId = useRef(1);
  const glossRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const sound = useMemo(() => createSound(() => store.get().settings.sound), [store]);
  const buzz = useMemo(() => createHaptics(() => store.get().settings.haptics), [store]);

  const toast = useCallback((msg: string) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts, { id, msg, show: false }]);
    requestAnimationFrame(() => setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, show: true } : t))));
    setTimeout(() => setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, show: false } : t))), 1800);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2100);
  }, []);

  const confirm = useCallback(
    (msg: string, ok: string, cancel: string) => new Promise<boolean>((resolve) => setConfirm({ msg, ok, cancel, resolve })),
    [],
  );
  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirm(null);
  };
  useEffect(() => {
    if (confirmState) okRef.current?.focus();
  }, [confirmState]);

  // 用語ポップアップ：外側のタップ・Esc で閉じる
  useEffect(() => {
    if (!gloss) return;
    const onDown = (e: PointerEvent) => {
      if (glossRef.current && !glossRef.current.contains(e.target as Node)) setGloss(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGloss(null);
    const id = setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [gloss]);

  const value = useMemo<Ui>(() => ({ store, sound, buzz, toast, showGloss: setGloss, confirm }), [store, sound, buzz, toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}
      {gloss && (
        <div className="gloss show" role="dialog" aria-label={`${gloss}の説明`} ref={glossRef}>
          <div className="gloss-head">
            <strong>{gloss}</strong>
            <button type="button" className="icon-btn" aria-label="閉じる" onClick={() => setGloss(null)}>
              ×
            </button>
          </div>
          <p>{GLOSSARY[gloss] ?? ''}</p>
        </div>
      )}
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.show ? ' show' : '')} role="status">
          {t.msg}
        </div>
      ))}
      {confirmState && (
        <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && closeConfirm(false)}>
          <div className="modal" role="alertdialog" aria-modal="true">
            <p>{confirmState.msg}</p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => closeConfirm(false)}>
                {confirmState.cancel}
              </button>
              <button type="button" className="btn primary" ref={okRef} onClick={() => closeConfirm(true)}>
                {confirmState.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}
