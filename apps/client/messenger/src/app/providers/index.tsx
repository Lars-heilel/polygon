import { type ReactNode } from 'react';

import { AuthBootstrap } from '@org/entities';
import { ErrorBoundary, ThemeProvider, Toaster, queryClient } from '@org/shared';
import { QueryClientProvider } from '@tanstack/react-query';

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
