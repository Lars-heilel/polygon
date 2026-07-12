import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

import { Input } from './input';

describe('Input', () => {
  it('toggles password visibility when revealable', async () => {
    const user = userEvent.setup();

    render(
      <Input
        label="Password"
        type="password"
        revealable
      />,
    );

    const input = screen.getByLabelText('Password', { selector: 'input' });
    expect(input.getAttribute('type')).toBe('password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.getAttribute('type')).toBe('text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.getAttribute('type')).toBe('password');
  });
});
