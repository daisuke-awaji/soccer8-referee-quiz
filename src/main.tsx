import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UiProvider } from './app/context';
import { QUESTIONS, STAGES } from './content';
import { createStore } from './storage/store';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/app.css';

const store = createStore(new Set(QUESTIONS.map((q) => q.id)), new Set(STAGES.map((s) => s.id)));

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <UiProvider store={store}>
      <App />
    </UiProvider>
  </StrictMode>,
);
