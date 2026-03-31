import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';

import { server } from '../../../test/server';
import { CheckEmailScreen } from '../ui/check-email-screen';

function renderScreen(email = 'user@example.com') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CheckEmailScreen email={email} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CheckEmailScreen', () => {
  it('displays the email address', () => {
    renderScreen('hello@example.com');
    expect(screen.getByText(/hello@example\.com/)).toBeInTheDocument();
  });

  it('shows success alert after resend', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/email sent/i);
    });
  });

  it('shows rate-limited alert on 429', async () => {
    server.use(
      http.post('/api/auth/resend-verification', () =>
        HttpResponse.json({ message: 'Too many requests' }, { status: 429 }),
      ),
    );

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/please wait/i);
    });
  });

  it('shows error alert on server failure', async () => {
    server.use(
      http.post('/api/auth/resend-verification', () =>
        HttpResponse.json({ message: 'Internal error' }, { status: 500 }),
      ),
    );

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /resend email/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to send/i);
    });
  });

  it('renders back to sign in link', () => {
    renderScreen();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
  });
});
