import { useEffect, useState } from 'react';

import type { DeleteMessageMode, Message } from '@org/entities-message';
import { Button, Modal, Text } from '@org/shared';

interface DeleteMessageModalProps {
  message: Message | null;
  isMine: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: DeleteMessageMode) => void;
}

export function DeleteMessageModal({
  message,
  isMine,
  isOpen,
  onClose,
  onConfirm,
}: DeleteMessageModalProps) {
  const [deleteForEveryone, setDeleteForEveryone] = useState(isMine);

  useEffect(() => {
    if (isOpen) setDeleteForEveryone(isMine);
  }, [isMine, isOpen]);

  if (!message) return null;

  const mode: DeleteMessageMode = isMine && deleteForEveryone ? 'EVERYONE' : 'ME';

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <Modal.Header title="Delete message" />
      <Modal.Body>
        <Text size="sm" color="muted">
          This message will be removed from the chat history.
        </Text>
        {isMine ? (
          <label className="mt-4 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={deleteForEveryone}
              onChange={(event) => setDeleteForEveryone(event.target.checked)}
            />
            Delete for everyone
          </label>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={() => onConfirm(mode)}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
