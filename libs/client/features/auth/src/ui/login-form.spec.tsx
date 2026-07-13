import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

const renderLoginForm = (onSubmit = vi.fn()) => {
  render(
    <MemoryRouter>
      <LoginForm onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return onSubmit;
};

describe('LoginForm', () => {
  it('does not submit invalid credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = renderLoginForm();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = renderLoginForm(vi.fn().mockResolvedValue(undefined));

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'user@example.com', password: 'password' },
      expect.anything(),
    );
  });

  it('can reveal and hide the password input', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const password = screen.getByLabelText('Password', { selector: 'input' });
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
