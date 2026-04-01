import { StrictMode } from 'react';

import { initSocketMiddleware } from '@org/features';
import * as ReactDOM from 'react-dom/client';

import App from './app';
import './config/env';
import './styles/global.css';

initSocketMiddleware();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
