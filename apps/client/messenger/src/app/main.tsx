import { StrictMode } from 'react';

import { useSessionStore } from '@org/entities-user';
import { configureAuthedFetch, frontendLog } from '@org/shared';
import * as ReactDOM from 'react-dom/client';

import App from './app';
import './config/env';
import { initSocketMiddleware } from './socket/socket-middleware';
import './styles/global.css';

configureAuthedFetch(() => useSessionStore.getState().setAuthenticated(false));
initSocketMiddleware();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      frontendLog('error', 'ServiceWorker', 'registration_failed', { hasError: !!err });
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
