import { type ReactNode } from 'react';

import { AuthBootstrap, useSessionStore } from '@org/entities-user';
import { ErrorBoundary, ThemeProvider, Toaster, configureAuthedFetch, queryClient } from '@org/shared';
import { QueryClientProvider } from '@tanstack/react-query';

interface ProvidersProps {
  children: ReactNode;
}

export function configureAdminAuthFetch(): void {
  configureAuthedFetch(() => useSessionStore.getState().setAuthenticated(false));
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthBootstrap />
          {children}
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
