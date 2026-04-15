import { type ReactNode, useEffect } from 'react';

import { authApi, useSessionStore } from '@org/entities';
import { ErrorBoundary, ThemeProvider, Toaster, queryClient } from '@org/shared';
import { QueryClientProvider } from '@tanstack/react-query';

function AuthBootstrap() {
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  useEffect(() => {
    authApi
      .me()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, [setAuthenticated]);

  return null;
}

interface ProvidersProps {
  children: ReactNode;
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
