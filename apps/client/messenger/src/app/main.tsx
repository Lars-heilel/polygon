import './styles/global.css';
import './config/env';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app';
import { initSocketMiddleware } from './socket/socket-middleware';

initSocketMiddleware();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
