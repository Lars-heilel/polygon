import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useResendVerificationMock = vi.hoisted(() => vi.fn());

vi.mock('../model/use-resend-verification', () => ({
  useResendVerification: useResendVerificationMock,
}));

import { CheckEmailScreen } from './check-email-screen';

const renderCheckEmailScreen = (email?: string) => {
  render(
    <MemoryRouter>
      <CheckEmailScreen email={email} />
    </MemoryRouter>,
  );
};

describe('CheckEmailScreen', () => {
  beforeEach(() => {
    useResendVerificationMock.mockReturnValue({
      resend: vi.fn(),
      isPending: false,
      status: 'idle',
    });
  });

  it('does not expose an email or resend action when email is absent', () => {
    renderCheckEmailScreen();

    expect(screen.getByText('We sent a verification link. Click the link to activate your account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument();
  });

  it('resends verification when an email is provided', async () => {
    const user = userEvent.setup();
    const resend = vi.fn();
    useResendVerificationMock.mockReturnValue({
      resend,
      isPending: false,
      status: 'idle',
    });

    renderCheckEmailScreen('pending@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(resend).toHaveBeenCalledWith('pending@example.com');
  });
});
