import { fireEvent, render, screen } from '@testing-library/react';

import { MessageActionsMenu } from '@org/entities-message';
import type { Message } from '@org/entities-message';

const baseMessage: Message = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text: 'hello',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  media: null,
  linkPreview: null,
  fileId: null,
  fileBucket: null,
  fileKey: null,
  fileName: null,
  fileSize: null,
  fileMime: null,
  fileCategory: null,
  forwardedFromId: null,
};

describe('message actions ui', () => {
  it('shows edit only for own text messages without files', () => {
    render(
      <MessageActionsMenu
        message={baseMessage}
        isMine
        onEdit={jest.fn()}
        onForward={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Message actions'));

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy();
  });

  it('hides edit for file messages and keeps forward copy delete', () => {
    render(
      <MessageActionsMenu
        message={{ ...baseMessage, fileId: 'file-1' }}
        isMine
        onEdit={jest.fn()}
        onForward={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Message actions'));

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
  });
});
