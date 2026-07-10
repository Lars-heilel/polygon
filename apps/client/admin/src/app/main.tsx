import { StrictMode } from 'react';

import {
  configureFrontendErrorReporting,
  registerGlobalFrontendErrorHandlers,
} from '@org/shared';
import * as ReactDOM from 'react-dom/client';

import App from './app';
import './config/env';
import { configureAdminAuthFetch } from './providers';
import './styles.css';

configureFrontendErrorReporting('admin');
registerGlobalFrontendErrorHandlers();
configureAdminAuthFetch();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
