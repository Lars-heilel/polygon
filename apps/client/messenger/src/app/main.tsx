import { StrictMode } from 'react';

import { useSessionStore } from '@org/entities-user';
import { configureAuthedFetch } from '@org/shared';
import * as ReactDOM from 'react-dom/client';

import App from './app';
import './config/env';
import { initSocketMiddleware } from './socket/socket-middleware';
import './styles/global.css';

configureAuthedFetch(() => useSessionStore.getState().setAuthenticated(false));
initSocketMiddleware();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
