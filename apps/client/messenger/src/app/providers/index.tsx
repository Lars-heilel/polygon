import { type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { ThemeProvider, ErrorBoundary, Toaster } from '@org/shared';
import { store } from '../store';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <ReduxProvider store={store}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
