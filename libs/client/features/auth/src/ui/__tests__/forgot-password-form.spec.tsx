import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ForgotPasswordForm } from '../forgot-password-form';

const renderForgotPasswordForm = (onSubmit = vi.fn()) => {
  render(
    <MemoryRouter>
      <ForgotPasswordForm onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return onSubmit;
};

describe('ForgotPasswordForm', () => {
  it('does not submit invalid email', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForgotPasswordForm();

    await user.type(screen.getByLabelText('Email'), 'bad-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows success state after a successful request', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForgotPasswordForm(vi.fn().mockResolvedValue(undefined));

    await user.type(screen.getByLabelText('Email'), 'recover@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(onSubmit).toHaveBeenCalledWith({ email: 'recover@example.com' }, expect.anything());
    expect(await screen.findByText('We sent a reset link to your email. Check your inbox.')).toBeInTheDocument();
  });
});
