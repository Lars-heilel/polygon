import { Component, type ErrorInfo, type ReactNode } from 'react';

import { reportFrontendError } from '../../lib/observability/frontend-error-reporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportFrontendError(error, info.componentStack ?? undefined);
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-center px-4">
            <span
              role="img"
              aria-label="Explosion"
              className="text-5xl select-none"
            >
              💥
            </span>
            <h1 className="text-xl font-semibold text-text">Something went wrong</h1>
            <p className="text-text-muted text-sm max-w-xs">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
