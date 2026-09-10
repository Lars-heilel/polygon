import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '../modal';

describe('Modal', () => {
  it('renders above chat footers and popovers', () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <Modal.Header title="Profile" />
        <Modal.Body>Profile body</Modal.Body>
      </Modal>,
    );

    expect(screen.getByRole('dialog').parentElement?.className).toContain('z-[100]');
  });
});
