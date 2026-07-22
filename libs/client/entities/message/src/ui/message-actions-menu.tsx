import { memo, useCallback, useState } from 'react';

import { Dropdown, IconButton } from '@org/shared';

import type { Message } from '../message.api.js';

interface MessageActionsMenuProps {
  message: Message;
  isMine: boolean;
  onEdit: (message: Message) => void;
  onForward: (message: Message) => void;
  onDelete: (message: Message) => void;
}

export const MessageActionsMenu = memo(function MessageActionsMenu({
  message,
  isMine,
  onEdit,
  onForward,
  onDelete,
}: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const canEdit = isMine && message.type === 'TEXT' && !message.fileId;
  const canCopy = Boolean(message.text);

  const handleCopy = useCallback(() => {
    if (!message.text) return;
    void navigator.clipboard?.writeText(message.text);
  }, [message.text]);

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dropdown.Trigger>
        <IconButton
          type="button"
          label="Message actions"
          icon={<span aria-hidden="true">...</span>}
          size="sm"
          variant="ghost"
          className="h-7 w-7"
        />
      </Dropdown.Trigger>
      <Dropdown.Menu align="right" className="w-40">
        {canEdit ? (
          <Dropdown.Item onClick={() => onEdit(message)}>Edit</Dropdown.Item>
        ) : null}
        <Dropdown.Item onClick={() => onForward(message)}>Forward</Dropdown.Item>
        <Dropdown.Item disabled={!canCopy} onClick={handleCopy}>Copy</Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item danger onClick={() => onDelete(message)}>Delete</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
});
