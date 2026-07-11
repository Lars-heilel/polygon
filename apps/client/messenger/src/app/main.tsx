import { StrictMode } from 'react';

import { useSessionStore } from '@org/entities-user';
import {
  configureAuthedFetch,
  configureFrontendErrorReporting,
  registerGlobalFrontendErrorHandlers,
  reportFrontendError,
} from '@org/shared';
import * as ReactDOM from 'react-dom/client';

import App from './app';
import './config/env';
import { initSocketMiddleware } from './socket/socket-middleware';
import './styles/global.css';

configureFrontendErrorReporting('messenger');
registerGlobalFrontendErrorHandlers();
configureAuthedFetch(() => useSessionStore.getState().setAuthenticated(false));
initSocketMiddleware();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      const error = err instanceof Error ? err : new Error('Service worker registration failed');
      reportFrontendError(error);
      if (import.meta.env.DEV) {
        console.error('SW registration failed:', err);
      }
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
