# Profile Media Modal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align profile and media modal experiences with the shared application UI while preserving the user flows for profile context, chat media search, and fullscreen media preview.

**Architecture:** Keep `@org/shared` as the owner of generic modal/viewer primitives. Refactor `UserProfileModal` to consume `Modal` and shared controls, keep `ProfileMediaPanel` feature-local, and update shared `MediaViewer` once so all message/profile media entry points inherit the same theme-aware behavior.

**Tech Stack:** React 19, TypeScript, `@testing-library/react`, Jest for messenger app tests, Vitest for `@org/shared`, Embla carousel, Nx.

## Global Constraints

- Do not change media fetching APIs.
- Do not change chat media grouping or filtering semantics.
- Do not redesign profile pages outside the modal.
- Do not replace Embla carousel.
- Do not replace existing shared `Modal`.
- Do not change backend or upload behavior.
- Preserve `MediaViewer` public props: `isOpen`, `items`, `initialIndex`, `onClose`.
- Use Nx through `env NX_ISOLATE_PLUGINS=false npm exec nx -- ...`.
- Respect existing dirty worktree changes; do not revert unrelated files.

---

## File Map

- `libs/client/shared/src/ui/media-viewer/media-viewer.tsx`: shared fullscreen media preview, controls, keyboard behavior, responsive chrome.
- `libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx`: new Vitest coverage for viewer open/close/navigation/caption.
- `libs/client/features/user-profile/src/ui/user-profile-modal.tsx`: profile dialog shell and profile/media tab container.
- `apps/client/messenger/src/app/user-profile-modal.spec.tsx`: new Jest coverage for profile modal loading/error/profile/media/send action using the messenger app test target.
- `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`: chat media scanning panel styles, loading, filters, cards.
- `apps/client/messenger/src/app/profile-media-panel.spec.tsx`: new Jest coverage for media filters, empty/loading/content states using the messenger app test target.
- `apps/client/messenger/src/test-stubs/shared.tsx`: app Jest stub for newly consumed shared primitives when feature components are tested through messenger.
- `apps/client/messenger/src/app/message-file-rendering.spec.tsx`: existing app-level message rendering coverage; keep passing after shared viewer changes.

---

### Task 1: Theme-Aware Shared MediaViewer

**Files:**
- Modify: `libs/client/shared/src/ui/media-viewer/media-viewer.tsx`
- Create: `libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx`

**Interfaces:**
- Consumes: `IconButton`, `Text`, `cn` from `@org/shared` internals.
- Produces: unchanged `MediaViewer({ isOpen, items, initialIndex, onClose })`.

- [ ] **Step 1: Write failing MediaViewer tests**

Create `libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaViewer, type MediaViewerItem } from './media-viewer';

const items: MediaViewerItem[] = [
  { id: 'image-1', type: 'image', src: '/one.png', alt: 'First image', label: 'First image' },
  { id: 'video-1', type: 'video', src: '/two.mp4', alt: 'Second video', label: 'Second video' },
];

describe('MediaViewer', () => {
  it('renders the selected media, caption, count, and theme-aware controls', () => {
    render(<MediaViewer isOpen items={items} initialIndex={1} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Close media viewer')).toBeTruthy();
    expect(screen.getByLabelText('Previous media')).toBeTruthy();
    expect(screen.getByLabelText('Next media')).toBeTruthy();
    expect(screen.getByText('Second video')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTestId('media-viewer')).toHaveClass('bg-background/95');
    expect(screen.getByTestId('media-viewer-chrome')).toHaveClass('bg-surface');
  });

  it('closes from button, Escape, and backdrop click', () => {
    const onClose = vi.fn();
    render(<MediaViewer isOpen items={items} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close media viewer'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('media-viewer'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('supports keyboard navigation labels without changing the public API', () => {
    render(<MediaViewer isOpen items={items} initialIndex={0} onClose={vi.fn()} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    expect(screen.getByLabelText('Next media')).toBeTruthy();
    expect(screen.getByLabelText('Previous media')).toBeTruthy();
  });

  it('renders nothing when closed or empty', () => {
    const { rerender } = render(<MediaViewer isOpen={false} items={items} onClose={vi.fn()} />);
    expect(screen.queryByTestId('media-viewer')).toBeNull();

    rerender(<MediaViewer isOpen items={[]} onClose={vi.fn()} />);
    expect(screen.queryByTestId('media-viewer')).toBeNull();
  });
});
```

- [ ] **Step 2: Run red shared test**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/shared -- --run src/ui/media-viewer/media-viewer.spec.tsx
```

Expected: FAIL because `data-testid="media-viewer"`, `data-testid="media-viewer-chrome"`, and accessible control labels do not exist.

- [ ] **Step 3: Implement MediaViewer chrome**

Update `libs/client/shared/src/ui/media-viewer/media-viewer.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';

import useEmblaCarousel from 'embla-carousel-react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';
import { IconButton } from '../icon-button';
import { Text } from '../typography';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  alt?: string;
  label?: string | null;
}

interface MediaViewerProps {
  isOpen: boolean;
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function MediaViewer({
  isOpen,
  items,
  initialIndex = 0,
  onClose,
}: MediaViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: items.length > 1,
    startIndex: initialIndex,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') scrollPrev();
      if (event.key === 'ArrowRight') scrollNext();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, scrollNext, scrollPrev]);

  useEffect(() => {
    if (!emblaApi || !isOpen) return;
    emblaApi.reInit({ loop: items.length > 1, startIndex: initialIndex });
    emblaApi.scrollTo(initialIndex, true);
    onSelect();
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, initialIndex, isOpen, items.length, onSelect]);

  if (!isOpen || items.length === 0) {
    return null;
  }

  const activeItem = items[selectedIndex];

  return createPortal(
    <div
      data-testid="media-viewer"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-3 text-text sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      <div
        className="relative z-10 flex h-full w-full max-w-6xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          data-testid="media-viewer-chrome"
          className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-2 py-2 shadow-lg sm:px-3"
        >
          <Text size="sm" className="min-w-0 flex-1 truncate">
            {activeItem?.label ?? activeItem?.alt ?? 'Media'}
          </Text>
          {items.length > 1 && (
            <Text size="xs" color="muted" className="shrink-0 tabular-nums">
              {selectedIndex + 1} / {items.length}
            </Text>
          )}
          <IconButton
            type="button"
            label="Close media viewer"
            size="sm"
            variant="ghost"
            onClick={onClose}
            icon={<span aria-hidden="true" className="text-lg leading-none">x</span>}
          />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-black">
          {items.length > 1 && (
            <>
              <IconButton
                type="button"
                label="Previous media"
                size="lg"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  scrollPrev();
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-surface/90 sm:left-4"
                icon={<span aria-hidden="true" className="text-2xl leading-none">‹</span>}
              />
              <IconButton
                type="button"
                label="Next media"
                size="lg"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  scrollNext();
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-surface/90 sm:right-4"
                icon={<span aria-hidden="true" className="text-2xl leading-none">›</span>}
              />
            </>
          )}

          <div className="h-full overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
              {items.map((item, index) => (
                <div key={item.id} className="flex min-w-0 shrink-0 basis-full items-center justify-center p-2 sm:p-6">
                  {item.type === 'image' ? (
                    <img
                      src={item.src}
                      alt={item.alt ?? item.label ?? 'Media'}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="max-h-full max-w-full rounded-md object-contain"
                      controls
                      autoPlay={selectedIndex === index}
                      playsInline
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {items.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Open media ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  index === selectedIndex ? 'bg-primary' : 'bg-surface-elevated',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Run green shared test**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/shared -- --run src/ui/media-viewer/media-viewer.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Run shared typecheck/lint**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/shared
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/shared
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add libs/client/shared/src/ui/media-viewer/media-viewer.tsx libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx
git commit -m "feat: align media viewer with app ui"
```

---

### Task 2: Shared-Shell UserProfileModal

**Files:**
- Modify: `libs/client/features/user-profile/src/ui/user-profile-modal.tsx`
- Create: `apps/client/messenger/src/app/user-profile-modal.spec.tsx`
- Modify: `apps/client/messenger/src/test-stubs/shared.tsx`

**Interfaces:**
- Consumes: existing `useUserProfileQuery(userId)`, `useCreateDirectChatMutation()`, `AvatarCarousel`, `ProfileMediaPanel`.
- Produces: unchanged `UserProfileModal({ userId, chatId, onClose, showSendButton })`.

- [ ] **Step 1: Write failing UserProfileModal tests**

Create `apps/client/messenger/src/app/user-profile-modal.spec.tsx`:

```tsx
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { useCreateDirectChatMutation } from '@org/entities-chat';

import { useUserProfileQuery } from '../../../../../libs/client/features/user-profile/src/api/use-user-profile';
import { UserProfileModal } from '../../../../../libs/client/features/user-profile/src/ui/user-profile-modal';

jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('@org/entities-chat', () => ({
  useCreateDirectChatMutation: jest.fn(),
}));

jest.mock('@org/features-upload-avatar', () => ({
  AvatarCarousel: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="avatar-carousel" /> : null),
}));

jest.mock('../../../../../libs/client/features/user-profile/src/api/use-user-profile', () => ({
  useUserProfileQuery: jest.fn(),
}));

jest.mock('../../../../../libs/client/features/user-profile/src/ui/profile-media-panel', () => ({
  ProfileMediaPanel: ({ chatId }: { chatId: string }) => <div data-testid="profile-media-panel">{chatId}</div>,
}));

const profile = {
  id: 'user-1',
  name: 'alice',
  displayName: 'Alice Doe',
  email: 'alice@example.com',
  avatarUrl: null,
  bio: 'Product designer',
  role: 'USER',
};

const mockedUseUserProfileQuery = jest.mocked(useUserProfileQuery);
const mockedUseCreateDirectChatMutation = jest.mocked(useCreateDirectChatMutation);

describe('UserProfileModal', () => {
  beforeEach(() => {
    mockedUseCreateDirectChatMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ id: 'chat-new' }),
    } as never);
  });

  it('uses the shared dialog shell and closes from the shared close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockedUseUserProfileQuery.mockReturnValue({ data: profile, isLoading: false, isError: false } as never);

    render(<UserProfileModal userId="user-1" onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders loading, error, and loaded profile states', () => {
    mockedUseUserProfileQuery.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false } as never);
    const { rerender } = render(<UserProfileModal userId="user-1" onClose={jest.fn()} />);
    expect(screen.getByTestId('profile-modal-loading')).toBeTruthy();

    mockedUseUserProfileQuery.mockReturnValueOnce({ data: undefined, isLoading: false, isError: true } as never);
    rerender(<UserProfileModal userId="user-1" onClose={jest.fn()} />);
    expect(screen.getByText('Failed to load profile')).toBeTruthy();

    mockedUseUserProfileQuery.mockReturnValueOnce({ data: profile, isLoading: false, isError: false } as never);
    rerender(<UserProfileModal userId="user-1" onClose={jest.fn()} />);
    expect(screen.getByText('Alice Doe')).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Product designer')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('switches to media tab only when chat media exists', async () => {
    const user = userEvent.setup();
    mockedUseUserProfileQuery.mockReturnValue({ data: profile, isLoading: false, isError: false } as never);

    render(<UserProfileModal userId="user-1" chatId="chat-1" onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Media' }));
    expect(screen.getByTestId('profile-media-panel')).toHaveTextContent('chat-1');
  });

  it('creates a direct chat from the primary action', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const mutateAsync = jest.fn().mockResolvedValue({ id: 'chat-new' });
    mockedUseCreateDirectChatMutation.mockReturnValue({ mutateAsync } as never);
    mockedUseUserProfileQuery.mockReturnValue({ data: profile, isLoading: false, isError: false } as never);

    render(<UserProfileModal userId="user-1" onClose={onClose} showSendButton />);

    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ targetUserId: 'user-1' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run red profile modal test**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand src/app/user-profile-modal.spec.tsx
```

Expected: FAIL because `UserProfileModal` does not yet use the shared modal shell and `profile-modal-loading` does not exist.

- [ ] **Step 3: Extend messenger shared test stub**

Modify `apps/client/messenger/src/test-stubs/shared.tsx` so app Jest can render the feature component after it starts consuming more shared primitives:

```tsx
import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from 'react';

const ModalCloseContext = createContext<(() => void) | null>(null);

export function Button({
  children,
  loading,
  disabled,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button disabled={disabled || loading} {...props}>{loading ? 'Loading' : children}</button>;
}

export function IconButton({
  icon,
  label,
  ...props
}: {
  icon: ReactNode;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button aria-label={label} {...props}>{icon}</button>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div data-testid="skeleton" className={className} />;
}

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <ModalCloseContext.Provider value={onClose}>
      <div role="dialog">{children}</div>
    </ModalCloseContext.Provider>
  );
}

Modal.Header = function ModalHeader({ title }: { title: string }) {
  const onClose = useContext(ModalCloseContext);

  return (
    <div>
      <h2>{title}</h2>
      <button type="button" aria-label="Close" onClick={() => onClose?.()}>Close</button>
    </div>
  );
};

Modal.Body = function ModalBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};
```

- [ ] **Step 4: Implement shared-shell profile modal**

Modify `libs/client/features/user-profile/src/ui/user-profile-modal.tsx`:

```tsx
import { useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { AvatarCarousel } from '@org/features-upload-avatar';
import { Avatar, Badge, Button, Heading, Modal, Skeleton, Text } from '@org/shared';
import { useNavigate } from 'react-router';

import { useUserProfileQuery } from '../api/use-user-profile.js';
import { ProfileMediaPanel } from './profile-media-panel.js';

interface UserProfileModalProps {
  userId: string;
  chatId?: string;
  onClose: () => void;
  showSendButton?: boolean;
}

export function UserProfileModal({
  userId,
  chatId,
  onClose,
  showSendButton,
}: UserProfileModalProps) {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError } = useUserProfileQuery(userId);
  const createChat = useCreateDirectChatMutation();
  const [activeTab, setActiveTab] = useState<'profile' | 'media'>('profile');
  const [creatingChat, setCreatingChat] = useState(false);
  const [avatarHistoryOpen, setAvatarHistoryOpen] = useState(false);

  const handleSendMessage = useCallback(async () => {
    if (creatingChat) return;
    setCreatingChat(true);
    try {
      const newChat = await createChat.mutateAsync({ targetUserId: userId });
      onClose();
      navigate(`/chats/${newChat.id}`);
    } catch {
      setCreatingChat(false);
    }
  }, [userId, createChat, onClose, navigate, creatingChat]);

  return (
    <>
      <Modal isOpen onClose={onClose} className="flex h-[600px] max-h-[85vh] max-w-lg flex-col">
        <Modal.Header title="Profile" />

        <Modal.Body className="min-h-0 flex-1 p-0">
          {isLoading ? (
            <div data-testid="profile-modal-loading" className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : isError || !profile ? (
            <div className="flex h-full items-center justify-center px-6 py-8">
              <Text size="sm" color="muted">Failed to load profile</Text>
            </div>
          ) : activeTab === 'media' && chatId ? (
            <div className="h-full min-h-0 p-4">
              <ProfileMediaPanel chatId={chatId} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center gap-3 overflow-y-auto px-6 py-6">
              <button type="button" onClick={() => setAvatarHistoryOpen(true)} className="shrink-0 rounded-full">
                <Avatar
                  src={profile.avatarUrl ?? undefined}
                  name={profile.displayName ?? profile.name}
                  size="xl"
                  className="ring-2 ring-border"
                />
              </button>

              <div className="text-center">
                <Heading level={5} as="h3" className="flex items-center justify-center gap-2">
                  {profile.displayName ?? profile.name}
                  {profile.role === 'CREATOR' && <Badge variant="primary">Creator</Badge>}
                </Heading>
                <Text size="xs" color="muted">@{profile.name}</Text>
              </div>

              {profile.bio && (
                <Text size="sm" className="max-w-xs break-words text-center">
                  {profile.bio}
                </Text>
              )}

              <div className="mt-3 w-full max-w-xs rounded-md border border-border bg-surface-elevated px-4 py-2 text-center">
                <Text size="sm" color="muted" className="break-all">{profile.email}</Text>
              </div>

              {showSendButton && (
                <Button
                  type="button"
                  loading={creatingChat}
                  onClick={handleSendMessage}
                  className="mt-auto w-full max-w-xs"
                >
                  Send message
                </Button>
              )}
            </div>
          )}
        </Modal.Body>

        {chatId && !isLoading && profile && (
          <Modal.Footer className="justify-stretch p-2">
            <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-border bg-surface-elevated p-1">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={activeTab === 'profile'
                  ? 'rounded-md bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm'
                  : 'rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text'}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={activeTab === 'media'
                  ? 'rounded-md bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm'
                  : 'rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text'}
              >
                Media
              </button>
            </div>
          </Modal.Footer>
        )}
      </Modal>

      {avatarHistoryOpen && (
        <AvatarCarousel
          isOpen={avatarHistoryOpen}
          onClose={() => setAvatarHistoryOpen(false)}
          userId={userId}
          readOnly
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: Run green profile modal test**

Run the same command that located the test in Step 2:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand src/app/user-profile-modal.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Run feature typecheck/lint**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/features-user-profile
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/features-user-profile
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add libs/client/features/user-profile/src/ui/user-profile-modal.tsx apps/client/messenger/src/app/user-profile-modal.spec.tsx apps/client/messenger/src/test-stubs/shared.tsx
git commit -m "feat: align user profile modal with shared ui"
```

---

### Task 3: ProfileMediaPanel Scanning UI

**Files:**
- Modify: `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`
- Create: `apps/client/messenger/src/app/profile-media-panel.spec.tsx`

**Interfaces:**
- Consumes: unchanged `ProfileMediaPanel({ chatId })`.
- Produces: unchanged media filters and viewer opening behavior.

- [ ] **Step 1: Write failing ProfileMediaPanel tests**

Create `apps/client/messenger/src/app/profile-media-panel.spec.tsx`:

```tsx
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

import { useGetChatsSuspenseQuery } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';

import { useChatMediaMessages } from '../../../../../libs/client/features/user-profile/src/api/use-chat-media';
import { ProfileMediaPanel } from '../../../../../libs/client/features/user-profile/src/ui/profile-media-panel';

jest.mock('@org/entities-chat', () => ({
  useGetChatsSuspenseQuery: jest.fn(),
}));

jest.mock('@org/entities-user', () => ({
  useMeSuspenseQuery: jest.fn(),
}));

jest.mock('../../../../../libs/client/features/user-profile/src/api/use-chat-media', () => ({
  ...jest.requireActual('../../../../../libs/client/features/user-profile/src/api/use-chat-media'),
  useChatMediaMessages: jest.fn(),
}));

const mockedUseChatMediaMessages = jest.mocked(useChatMediaMessages);

describe('ProfileMediaPanel', () => {
  beforeEach(() => {
    jest.mocked(useMeSuspenseQuery).mockReturnValue({ data: { id: 'me' } } as never);
    jest.mocked(useGetChatsSuspenseQuery).mockReturnValue({
      data: [{
        id: 'chat-1',
        members: [
          { userId: 'me', profile: { name: 'Me', displayName: 'Me' } },
          { userId: 'other', profile: { name: 'alice', displayName: 'Alice' } },
        ],
      }],
    } as never);
  });

  it('renders theme-aware filters and loading state', () => {
    mockedUseChatMediaMessages.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    } as never);

    render(<ProfileMediaPanel chatId="chat-1" />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('bg-primary');
    expect(screen.getByLabelText('Loading...')).toBeTruthy();
  });

  it('switches media filters without changing panel API', async () => {
    const user = userEvent.setup();
    mockedUseChatMediaMessages.mockReturnValue({
      data: { pages: [{ messages: [] }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    } as never);

    render(<ProfileMediaPanel chatId="chat-1" />);

    await user.click(screen.getByRole('button', { name: 'Photo' }));
    expect(mockedUseChatMediaMessages).toHaveBeenLastCalledWith('chat-1', 'IMAGE');
  });

  it('renders empty state with app text tokens', () => {
    mockedUseChatMediaMessages.mockReturnValue({
      data: { pages: [{ messages: [] }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    } as never);

    render(<ProfileMediaPanel chatId="chat-1" />);

    expect(screen.getByText('Nothing yet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run red panel test**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand src/app/profile-media-panel.spec.tsx
```

Expected: FAIL because the panel does not yet use the aligned filter/loading/card treatments asserted by the test.

- [ ] **Step 3: Implement panel style alignment**

Modify `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`:

- Import `Spinner` from `@org/shared`.
- Change filter container to `rounded-md border border-border bg-surface-elevated p-1`.
- Change selected filter class to `bg-primary text-white`.
- Change unselected filter class to `text-text-muted hover:bg-surface hover:text-text`.
- Replace loading spinners with `<Spinner color="primary" />`.
- Change media entry cards from `rounded-2xl bg-surface/60` to `rounded-md border border-border bg-surface-elevated p-3`.
- Change text-caption wrappers from `rounded-xl bg-background/70` to `rounded-md bg-surface p-2`.
- Change sticky date header to `bg-surface px-1 py-2 text-xs font-medium text-text-muted`.
- Change preview wrapper to `rounded-md bg-surface`.
- Change image/video preview classes to `h-48 w-full object-cover sm:h-56`.

- [ ] **Step 4: Run green panel test**

Run the same path that worked in Step 2:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand src/app/profile-media-panel.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Run app message regression tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand
```

Expected: PASS. This protects existing message image/video/file/circle rendering after shared `MediaViewer` changes.

- [ ] **Step 6: Commit Task 3**

```bash
git add libs/client/features/user-profile/src/ui/profile-media-panel.tsx apps/client/messenger/src/app/profile-media-panel.spec.tsx
git commit -m "feat: align profile media panel ui"
```

---

### Task 4: Final Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: verified implementation ready for review.

- [ ] **Step 1: Run focused UI tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/shared -- --run src/ui/media-viewer/media-viewer.spec.tsx
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and lint**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/shared
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/shared
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/features-user-profile
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/features-user-profile
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/messenger
```

Expected: PASS.

- [ ] **Step 3: Run existing chat scroll/media e2e smoke**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/messenger:e2e-ci--e2e/chat-scroll-layout.spec.ts
```

Expected: PASS or unchanged existing skips only.

- [ ] **Step 4: Check diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows only intentional task files plus any pre-existing unrelated worktree changes.
