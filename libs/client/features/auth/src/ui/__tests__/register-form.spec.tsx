import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from '../register-form';

const renderRegisterForm = (onSubmit = vi.fn(), apiError?: string | null) => {
  render(
    <MemoryRouter>
      <RegisterForm
        onSubmit={onSubmit}
        apiError={apiError}
      />
    </MemoryRouter>,
  );
  return onSubmit;
};

describe('RegisterForm', () => {
  it('does not submit when passwords do not match', async () => {
    const user = userEvent.setup();
    const onSubmit = renderRegisterForm();

    await user.type(screen.getByLabelText('Username'), 'tester');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'Aa1!aaaa');
    await user.type(screen.getByLabelText('Confirm password'), 'Aa1!bbbb');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid registration data', async () => {
    const user = userEvent.setup();
    const onSubmit = renderRegisterForm(vi.fn().mockResolvedValue(undefined));

    await user.type(screen.getByLabelText('Username'), 'tester');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'Aa1!aaaa');
    await user.type(screen.getByLabelText('Confirm password'), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(onSubmit).toHaveBeenCalledWith(
      {
        username: 'tester',
        email: 'new@example.com',
        password: 'Aa1!aaaa',
        confirmPassword: 'Aa1!aaaa',
      },
      expect.anything(),
    );
  });

  it('renders API errors without submitting by itself', () => {
    const onSubmit = renderRegisterForm(vi.fn(), 'This email is already registered.');

    expect(screen.getByRole('alert')).toHaveTextContent('This email is already registered.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
