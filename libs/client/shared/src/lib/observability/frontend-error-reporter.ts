import type { FrontendErrorPayload } from '@org/common';

type AppName = FrontendErrorPayload['app'];

let configuredApp: AppName | null = null;
let handlersRegistered = false;

export function configureFrontendErrorReporting(app: AppName): void {
  configuredApp = app;
}

export function reportFrontendError(error: Error, componentStack?: string): void {
  if (!configuredApp) return;

  const payload: FrontendErrorPayload = {
    app: configuredApp,
    route: window.location.pathname,
    message: error.message,
    stack: error.stack,
    componentStack,
    userAgent: window.navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  void fetch('/api/observability/frontend-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export function registerGlobalFrontendErrorHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    reportFrontendError(error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportFrontendError(reason);
  });
}
