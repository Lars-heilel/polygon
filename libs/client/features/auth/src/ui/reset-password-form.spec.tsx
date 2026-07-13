import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ResetPasswordForm } from './reset-password-form';

const renderResetPasswordForm = (route: string, onSubmit = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={[route]}>
      <ResetPasswordForm onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return onSubmit;
};

describe('ResetPasswordForm', () => {
  it('does not render the form when token is missing', () => {
    const onSubmit = renderResetPasswordForm('/auth/reset-password');

    expect(screen.getByText('Invalid or expired reset link.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set new password' })).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not expose the reset token in rendered text', () => {
    renderResetPasswordForm('/auth/reset-password?token=secret-reset-token');

    expect(screen.queryByText('secret-reset-token')).not.toBeInTheDocument();
  });

  it('submits matching passwords with the token', async () => {
    const user = userEvent.setup();
    const onSubmit = renderResetPasswordForm(
      '/auth/reset-password?token=reset-token',
      vi.fn().mockResolvedValue(undefined),
    );

    await user.type(screen.getByLabelText('New password'), 'Aa1!aaaa');
    await user.type(screen.getByLabelText('Confirm new password'), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(onSubmit).toHaveBeenCalledWith({
      password: 'Aa1!aaaa',
      confirmPassword: 'Aa1!aaaa',
      token: 'reset-token',
    });
  });
});
