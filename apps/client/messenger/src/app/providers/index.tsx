import { type ReactNode } from 'react';

import { AuthBootstrap } from '@org/entities-user';
import { ErrorBoundary, ThemeProvider, Toaster, queryClient } from '@org/shared';
import { QueryClientProvider } from '@tanstack/react-query';

import { PushNotificationBootstrapper } from '../push-notification-bootstrapper';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthBootstrap />
          <PushNotificationBootstrapper />
          {children}
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
