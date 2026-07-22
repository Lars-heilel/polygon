import { type MouseEvent, type ReactNode, createContext, useContext, useEffect } from 'react';

import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';
import { IconButton } from '../icon-button';
import { Heading } from '../typography';

interface ModalContextValue {
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('Modal subcomponents must be used within <Modal>');
  return ctx;
}

// --- Header ---

interface ModalHeaderProps {
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

function ModalHeader({ title, onClose, children, className }: ModalHeaderProps) {
  const { onClose: contextClose } = useModalContext();
  const handleClose = onClose ?? contextClose;

  if (title !== undefined) {
    return (
      <div
        className={cn(
          'px-6 py-4 border-b border-border flex items-center justify-between',
          className,
        )}
      >
        <Heading
          level={5}
          as="h2"
        >
          {title}
        </Heading>
        <IconButton
          type="button"
          label="Close"
          size="sm"
          variant="ghost"
          onClick={handleClose}
          icon={<CloseIcon />}
        />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

// --- Body ---

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={cn('px-6 py-4 overflow-y-auto', className)}>{children}</div>;
}

// --- Footer ---

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-border flex justify-end gap-3', className)}>
      {children}
    </div>
  );
}

// --- Root ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}

function ModalRoot({ isOpen, onClose, children, className, overlayClassName }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4',
          overlayClassName,
        )}
        onClick={handleOverlayClick}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'max-h-[min(90vh,42rem)] w-full max-w-md overflow-hidden rounded-lg',
            'border border-border bg-surface text-text shadow-[var(--shadow-popover)]',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body,
  );
}

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
