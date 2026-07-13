import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { EmailVerifiedScreen } from './email-verified-screen';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('EmailVerifiedScreen', () => {
  it('continues to chats after verification', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <EmailVerifiedScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('Your email is verified. You can continue to chats.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to chats' }));

    expect(navigate).toHaveBeenCalledWith('/chats');
  });
});
