import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CreateChatModal } from '../create-chat-modal.js';

function renderModal(overrides: Partial<Parameters<typeof CreateChatModal>[0]> = {}) {
  const onE2eeChange = vi.fn();
  render(
    <CreateChatModal
      isOpen
      onClose={() => undefined}
      users={[]}
      searchQuery=""
      onSearchChange={() => undefined}
      onSelectUser={() => undefined}
      e2eeEnabled
      onE2eeChange={onE2eeChange}
      {...overrides}
    />,
  );
  return { onE2eeChange };
}

describe('CreateChatModal E2EE toggle', () => {
  it('renders checked by default (E2EE default on)', () => {
    renderModal();
    expect(screen.getByRole('switch', { name: /end-to-end encryption/i })).toBeChecked();
  });

  it('calls onE2eeChange(false) when toggled off', async () => {
    const user = userEvent.setup();
    const { onE2eeChange } = renderModal();
    await user.click(screen.getByRole('switch', { name: /end-to-end encryption/i }));
    expect(onE2eeChange).toHaveBeenCalledWith(false);
  });

  it('reflects opt-out state', () => {
    renderModal({ e2eeEnabled: false });
    expect(
      screen.getByRole('switch', { name: /end-to-end encryption/i }),
    ).not.toBeChecked();
  });
});
