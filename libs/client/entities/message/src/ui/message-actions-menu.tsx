import { type CSSProperties, type ReactNode, memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconButton, cn } from '@org/shared';

import type { Message } from '../message.api.js';

interface MessageActionsMenuProps {
  message: Message;
  isMine: boolean;
  onEdit: (message: Message) => void;
  onForward: (message: Message) => void;
  onDelete: (message: Message) => void;
}

const MENU_WIDTH = 176;
const MENU_MARGIN = 8;
const MOBILE_MENU_MARGIN = 12;

function getMenuPosition(trigger: HTMLElement | null): CSSProperties {
  if (typeof window === 'undefined' || !trigger) {
    return { top: MENU_MARGIN, right: MENU_MARGIN };
  }

  if (window.innerWidth < 640) {
    return {
      bottom: MOBILE_MENU_MARGIN,
      left: MOBILE_MENU_MARGIN,
      right: MOBILE_MENU_MARGIN,
    };
  }

  const rect = trigger.getBoundingClientRect();
  const maxTop = Math.max(MENU_MARGIN, window.innerHeight - 220);
  const top = Math.min(
    Math.max(rect.bottom + MENU_MARGIN, MENU_MARGIN),
    maxTop,
  );
  const left = Math.min(
    Math.max(rect.right - MENU_WIDTH, MENU_MARGIN),
    window.innerWidth - MENU_WIDTH - MENU_MARGIN,
  );

  return { top, left, width: MENU_WIDTH };
}

interface MenuActionButtonProps {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function MenuActionButton({ children, danger, disabled, onClick }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center px-3 text-left text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-text hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}

export const MessageActionsMenu = memo(function MessageActionsMenu({
  message,
  isMine,
  onEdit,
  onForward,
  onDelete,
}: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLSpanElement>(null);
  const canEdit = isMine && message.type === 'TEXT' && !message.media;
  const canCopy = Boolean(message.text);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const openMenu = useCallback(() => {
    setMenuPosition(getMenuPosition(triggerRef.current));
    setIsOpen(true);
  }, []);

  const handleCopy = useCallback(() => {
    if (!message.text) return;
    void navigator.clipboard?.writeText(message.text);
    closeMenu();
  }, [closeMenu, message.text]);

  useEffect(() => {
    if (!isOpen) return;

    const handleWindowChange = () => {
      setMenuPosition(getMenuPosition(triggerRef.current));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  const handleOpenChange = useCallback(() => {
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  }, [closeMenu, isOpen, openMenu]);

  const handleEdit = useCallback(() => {
    closeMenu();
    onEdit(message);
  }, [closeMenu, message, onEdit]);

  const handleForward = useCallback(() => {
    closeMenu();
    onForward(message);
  }, [closeMenu, message, onForward]);

  const handleDelete = useCallback(() => {
    closeMenu();
    onDelete(message);
  }, [closeMenu, message, onDelete]);

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <IconButton
          type="button"
          label="Message actions"
          icon={<span aria-hidden="true" className="text-base leading-none">⋯</span>}
          size="sm"
          variant="ghost"
          onClick={handleOpenChange}
          className={cn(
            'h-8 w-8 rounded-md border-0 bg-transparent shadow-none',
            'transition-colors',
            isMine
              ? 'text-text-inverse/70 hover:bg-white/10 hover:text-text-inverse'
              : 'text-text-muted hover:bg-surface-elevated hover:text-text',
            isOpen && (isMine ? 'bg-white/10 text-text-inverse' : 'bg-surface-elevated text-text'),
          )}
        />
      </span>

      {isOpen && typeof document !== 'undefined' ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close message actions"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={closeMenu}
          />
          <div
            role="menu"
            aria-label="Message actions"
            style={menuPosition}
            className={cn(
              'fixed z-50 overflow-hidden border border-border bg-surface-elevated shadow-[var(--shadow-surface)]',
              'max-sm:rounded-md max-sm:p-1',
              'sm:w-44 sm:rounded-md sm:py-1',
            )}
          >
            {canEdit ? <MenuActionButton onClick={handleEdit}>Edit</MenuActionButton> : null}
            <MenuActionButton onClick={handleForward}>Forward</MenuActionButton>
            <MenuActionButton disabled={!canCopy} onClick={handleCopy}>Copy</MenuActionButton>
            <div className="my-1 h-px bg-border" />
            <MenuActionButton danger onClick={handleDelete}>Delete</MenuActionButton>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
});
