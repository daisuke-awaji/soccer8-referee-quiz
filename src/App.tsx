import { useEffect, useState } from 'react';
import { QMAP } from './content';
import { useUi } from './app/context';
import { clearHash, parseDirectLink } from './app/route';
import { useAppState } from './storage/store';
import { Home } from './screens/Home';
import { Quiz } from './screens/Quiz';
import { Result } from './screens/Result';

export type Screen =
  | { name: 'home' }
  | { name: 'quiz'; id: string; review: boolean; key: number }
  | { name: 'result' };

export interface Nav {
  home: () => void;
  /** 今の出題の続き（全問終わっていれば結果） */
  next: () => void;
  review: (id: string) => void;
  result: () => void;
}

let navKey = 0;

function screenFromHash(): Screen | null {
  const link = parseDirectLink(location.hash);
  if (!link || !QMAP[link.id]) return null;
  return { name: 'quiz', id: link.id, review: true, key: ++navKey };
}

export function App() {
  const { store } = useUi();
  const state = useAppState(store);
  const [screen, setScreen] = useState<Screen>(() => {
    return screenFromHash() ?? { name: 'home' };
  });

  useEffect(() => {
    const onHash = () => {
      const s = screenFromHash();
      if (s) setScreen(s);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [store]);

  const nav: Nav = {
    home: () => {
      clearHash();
      setScreen({ name: 'home' });
    },
    next: () => {
      const s = store.get();
      if (s.idx >= s.order.length) {
        if (!s.finished) store.set({ finished: true });
        setScreen({ name: 'result' });
      } else setScreen({ name: 'quiz', id: s.order[s.idx]!, review: false, key: ++navKey });
    },
    review: (id) => setScreen({ name: 'quiz', id, review: true, key: ++navKey }),
    result: () => {
      clearHash();
      const s = store.get();
      setScreen(s.order.length && Object.keys(s.results).length ? { name: 'result' } : { name: 'home' });
    },
  };

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [screen]);

  switch (screen.name) {
    case 'home':
      return <Home state={state} nav={nav} />;
    case 'quiz':
      return <Quiz key={screen.key} question={QMAP[screen.id]!} review={screen.review} state={state} nav={nav} />;
    case 'result':
      return <Result state={state} nav={nav} />;
  }
}
