import { type ReactNode, useEffect } from 'react';

import { authApi, useSessionStore } from '@org/entities';
import { ThemeProvider } from '@org/features';
import { ErrorBoundary, Toaster } from '@org/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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
