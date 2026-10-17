import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UiProvider } from './app/context';
import { QUESTIONS } from './content';
import { createStore } from './storage/store';
import './styles/app.css';

const store = createStore(new Set(QUESTIONS.map((q) => q.id)));

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <UiProvider store={store}>
      <App />
    </UiProvider>
  </StrictMode>,
);
