# Compound Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `Modal` and `Dropdown` in `@org/shared` to compound component pattern, add `createPortal` to Modal, and add `useDisclosure` hook.

**Architecture:** Each component owns a React Context shared with its subcomponents. `useDisclosure` is a standalone reusable hook. No new dependencies.

**Tech Stack:** React 19, TypeScript strict mode, Tailwind CSS

---

## File Map

| Action | Path |
|--------|------|
| Create | `libs/client/shared/src/lib/hooks/use-disclosure.ts` |
| Rewrite | `libs/client/shared/src/ui/modal/modal.tsx` |
| Rewrite | `libs/client/shared/src/ui/dropdown/dropdown.tsx` |
| Modify | `libs/client/shared/src/index.ts` |
| Migrate | `libs/client/pages/src/lib/messenger/ui/modals/create-chat-modal/create-chat-modal.tsx` |
| Migrate | `libs/client/pages/src/lib/messenger/ui/modals/settings-modal/settings-modal.tsx` |
| Migrate | `libs/client/pages/src/lib/messenger/ui/modals/profile-modal/profile-modal.tsx` |

---

## Task 1: useDisclosure hook

**Files:**
- Create: `libs/client/shared/src/lib/hooks/use-disclosure.ts`

- [ ] **Создай файл хука**

```ts
import { useCallback, useState } from 'react';

export function useDisclosure(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle, setIsOpen };
}
```

- [ ] **Добавь экспорт в index**

В `libs/client/shared/src/index.ts` добавь строку:

```ts
export { useDisclosure } from './lib/hooks/use-disclosure';
```

- [ ] **Коммит**

```bash
git add libs/client/shared/src/lib/hooks/use-disclosure.ts libs/client/shared/src/index.ts
git commit -m "feat(shared): add useDisclosure hook"
```

---

## Task 2: Modal — compound components + createPortal

**Files:**
- Rewrite: `libs/client/shared/src/ui/modal/modal.tsx`

- [ ] **Перепиши modal.tsx целиком**

```tsx
import { createContext, useContext, useEffect, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';
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
      <div className={cn('px-6 py-4 border-b border-border flex items-center justify-between', className)}>
        <Heading level={5} as="h2">{title}</Heading>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-surface-elevated rounded-lg"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
  return (
    <div className={cn('overflow-y-auto', className)}>
      {children}
    </div>
  );
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
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
        className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50', overlayClassName)}
        onClick={handleOverlayClick}
      >
        <div
          className={cn('bg-surface rounded-2xl shadow-2xl overflow-hidden max-w-md w-full mx-4', className)}
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
```

- [ ] **Проверь typecheck**

```bash
npx nx typecheck @org/shared
```

Ожидаем: без ошибок.

- [ ] **Коммит**

```bash
git add libs/client/shared/src/ui/modal/modal.tsx
git commit -m "feat(shared): refactor Modal to compound components with createPortal"
```

---

## Task 3: Dropdown — compound components

**Files:**
- Rewrite: `libs/client/shared/src/ui/dropdown/dropdown.tsx`

- [ ] **Перепиши dropdown.tsx целиком**

```tsx
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { cn } from '../../lib/utils/cn';
import { Divider } from '../divider';

interface DropdownContextValue {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown subcomponents must be used within <Dropdown>');
  return ctx;
}

// --- Trigger ---

function DropdownTrigger({ children }: { children: ReactNode }) {
  const { isOpen, onOpenChange } = useDropdownContext();
  return (
    <div onClick={() => onOpenChange(!isOpen)}>
      {children}
    </div>
  );
}

// --- Menu ---

interface DropdownMenuProps {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

function DropdownMenu({ children, align = 'left', className }: DropdownMenuProps) {
  const { isOpen } = useDropdownContext();

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 w-48 rounded-md bg-surface-elevated shadow-lg ring-1 ring-black ring-opacity-5',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

// --- Item ---

interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function DropdownItem({ children, icon, danger, disabled, onClick }: DropdownItemProps) {
  const { onOpenChange } = useDropdownContext();

  const handleClick = () => {
    onClick?.();
    onOpenChange(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-2 px-4 py-2 text-sm disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'text-text hover:bg-surface',
      )}
    >
      {icon && <span className="text-text-muted group-hover:text-text">{icon}</span>}
      {children}
    </button>
  );
}

// --- Divider ---

function DropdownDivider() {
  return <Divider />;
}

// --- Root ---

interface DropdownProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

function DropdownRoot({ isOpen, onOpenChange, children, className }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <DropdownContext.Provider value={{ isOpen, onOpenChange }}>
      <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Divider: DropdownDivider,
});
```

- [ ] **Проверь typecheck**

```bash
npx nx typecheck @org/shared
```

Ожидаем: без ошибок.

- [ ] **Коммит**

```bash
git add libs/client/shared/src/ui/dropdown/dropdown.tsx
git commit -m "feat(shared): refactor Dropdown to compound components"
```

---

## Task 4: Обнови экспорты @org/shared

**Files:**
- Modify: `libs/client/shared/src/index.ts`

- [ ] **Удали экспорт DropdownItem из index.ts**

Найди и удали эту строку:

```ts
export type { DropdownItem } from './ui/dropdown';
```

`DropdownItem` — внутренний тип, больше не нужен снаружи.

- [ ] **Проверь lint и typecheck**

```bash
npx nx run-many -t lint typecheck -p @org/shared @org/pages @org/messenger
```

Ожидаем: без ошибок.

- [ ] **Коммит**

```bash
git add libs/client/shared/src/index.ts
git commit -m "chore(shared): remove DropdownItem from public exports"
```

---

## Task 5: Мигрируй существующие модалки

**Files:**
- Migrate: `libs/client/pages/src/lib/messenger/ui/modals/create-chat-modal/create-chat-modal.tsx`
- Migrate: `libs/client/pages/src/lib/messenger/ui/modals/settings-modal/settings-modal.tsx`
- Migrate: `libs/client/pages/src/lib/messenger/ui/modals/profile-modal/profile-modal.tsx`

### CreateChatModal

- [ ] **Обнови create-chat-modal.tsx**

```tsx
import { Avatar, Heading, Input, Modal, Text } from '@org/shared';

interface User {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  isCreating?: boolean;
}

export function CreateChatModal({
  isOpen,
  onClose,
  users,
  searchQuery,
  onSearchChange,
  onSelectUser,
  isCreating = false,
}: CreateChatModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <Modal.Header title="New Chat" />

      <div className="p-4 border-b border-border">
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search users..."
          size="sm"
          disabled={isCreating}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      <Modal.Body className="max-h-96 p-2">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            disabled={isCreating}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated rounded-lg transition-colors disabled:opacity-50"
          >
            <Avatar name={user.displayName ?? user.name} size="md" />
            <div className="flex-1 text-left">
              <Text size="sm" weight="medium">{user.displayName ?? user.name}</Text>
              <Text size="xs" color="muted">@{user.name}</Text>
            </div>
          </button>
        ))}

        {users.length === 0 && searchQuery && (
          <Text size="sm" color="muted" className="text-center py-8">No users found</Text>
        )}
      </Modal.Body>
    </Modal>
  );
}
```

### SettingsModal

- [ ] **Обнови settings-modal.tsx — замени хедер**

Найди блок:

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  className="max-w-lg max-h-[80vh] flex flex-col"
>
  <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
    <Heading level={5} as="h2">Settings</Heading>
    <button
      onClick={onClose}
      className="p-2 hover:bg-surface-elevated rounded-lg"
    >
      <svg
        className="w-5 h-5"
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
    </button>
  </div>
```

Замени на:

```tsx
<Modal isOpen={isOpen} onClose={onClose} className="max-w-lg max-h-[80vh] flex flex-col">
  <Modal.Header title="Settings" />
```

Убери импорт `Heading` если больше нигде не используется в файле.

### ProfileModal

- [ ] **Обнови profile-modal.tsx — кастомный хедер через Modal.Header**

Найди блок:

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  className="max-w-md"
>
  <div className="relative h-32 bg-gradient-to-r from-primary to-primary/60">
    <button
      onClick={onClose}
      className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors text-white"
    >
      <svg
        className="w-5 h-5"
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
    </button>
  </div>
```

Замени на:

```tsx
<Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
  <Modal.Header>
    <div className="relative h-32 bg-gradient-to-r from-primary to-primary/60">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors text-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Modal.Header>
```

- [ ] **Финальная проверка**

```bash
npx nx run-many -t lint typecheck -p @org/shared @org/pages @org/messenger
```

Ожидаем: без ошибок.

- [ ] **Коммит**

```bash
git add libs/client/pages/src/lib/messenger/ui/modals/
git commit -m "feat(pages): migrate modals to compound Modal API"
```
