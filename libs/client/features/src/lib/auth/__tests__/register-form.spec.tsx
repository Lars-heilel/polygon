import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { RegisterForm } from '../ui/register-form';

function renderForm(props: Partial<React.ComponentProps<typeof RegisterForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <RegisterForm
        onSubmit={onSubmit}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onSubmit };
}

describe('RegisterForm', () => {
  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays apiError via FormAlert', () => {
    renderForm({ apiError: 'This email is already registered.' });
    expect(screen.getByRole('alert')).toHaveTextContent('This email is already registered.');
  });

  it('does not show alert when apiError is null', () => {
    renderForm({ apiError: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
    await userEvent.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
  });

  it('calls onSubmit with form values on valid submit', async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
    await userEvent.type(screen.getByLabelText(/^email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password1!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        username: 'testuser',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      }),
      expect.anything(),
    );
  });
});
