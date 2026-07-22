# Client UI System Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the client UI system so `global.css` owns semantic tokens/base styles only, shared primitives own reusable visual behavior, and messenger surfaces consume those primitives consistently.

**Architecture:** Keep `@org/shared` as the design-system owner. Start with a CSS contract test, replace broad global component overrides with explicit semantic tokens, update shared primitives to consume that token contract, then migrate the highest-impact messenger UI surfaces without changing business behavior.

**Tech Stack:** React 19, TypeScript, Tailwind v4 `@theme`, `class-variance-authority`, Vitest for `@org/shared`, Jest/Playwright for `@org/messenger`, Nx targets via `npm exec nx`.

## Global Constraints

- Preserve existing uncommitted WIP unless a task explicitly lists the same file and the current diff has been reviewed first.
- Use public imports from `@org/shared`; do not import deep shared implementation paths from feature/page code.
- Use `Text` and `Heading` for content typography before adding local `text-*` classes.
- Use local Tailwind classes primarily for layout: `flex`, `grid`, `gap`, spacing, sizing, overflow, responsive breakpoints.
- Do not add direct `console.*`; use `useLogger(context)` or `frontendLog` if a task adds observability.
- Run Nx tasks through `npm exec nx`.
- Keep commits small and task-scoped.

---

## Files And Responsibilities

- `libs/client/shared/src/styles/global.css`  
  Owns Tailwind `@source`, semantic tokens, theme overrides, document base styles, scrollbar/focus/selection, and third-party widget integration.

- `libs/client/shared/src/styles/global-css-contract.spec.ts`  
  Protects the `global.css` boundary by asserting required tokens exist and forbidden broad component selectors are absent.

- `libs/client/shared/src/ui/button/button.tsx`  
  Owns action button variants, sizes, loading, focus, disabled, and hover/active states.

- `libs/client/shared/src/ui/icon-button/icon-button.tsx`  
  Owns icon-only action variants, stable square sizing, loading, focus, disabled, hover/active states.

- `libs/client/shared/src/ui/input/input.tsx`  
  Owns field shell, label/helper/error text, focus, disabled, and icon spacing.

- `libs/client/shared/src/ui/textarea/textarea.tsx`  
  Owns multiline field shell, label/helper/error text, focus, disabled, and char count.

- `libs/client/shared/src/ui/modal/modal.tsx`  
  Owns portable modal overlay/shell/header/body/footer styling and behavior.

- `libs/client/shared/src/ui/badge/badge.tsx`  
  Owns compact status/role/count badge variants.

- `libs/client/shared/src/ui/toast/toaster.tsx`  
  Owns theme-aware Sonner classNames without hardcoded white text or black shadows.

- `libs/client/shared/src/ui/status-screen/status-screen.tsx`  
  Owns reusable success/error/info empty-result screens through semantic text colors.

- `libs/client/shared/src/ui/media-viewer/media-viewer.tsx`  
  Owns fullscreen media preview chrome with theme-aware controls.

- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`  
  Migrates composer controls to shared buttons/icon buttons and semantic status styles.

- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`  
  Migrates floating new-message action to shared `Button`/`IconButton` and shared typography.

- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-header/chat-header.tsx`  
  Migrates header action buttons and status text to shared primitives.

- `libs/client/pages/messenger/pages-chats-layout/src/lib/chats-tab.tsx`  
  Migrates list tab controls/search/sidebar empty states to shared primitives.

- `libs/client/pages/messenger/pages-chats-layout/src/lib/ui/sidebar/chat-list-sidebar/sidebar-content.tsx`  
  Migrates chat list loading/empty/error text and list item actions to shared primitives.

- `libs/client/entities/message/src/ui/message-bubble.tsx`  
  Migrates message bubble visual language to semantic token classes without relying on removed global `.bg-primary` hacks.

- `libs/client/entities/message/src/ui/file-message.tsx`  
  Migrates file/audio cards to semantic tokens and existing shared typography where practical.

- `libs/client/features/user-profile/src/ui/user-profile-modal.tsx`  
  Migrates profile modal shell/actions to shared `Modal`, `Button`, `Badge`, `Text`, `Heading`, `Skeleton`.

- `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`  
  Migrates profile media filters/loading/empty states to shared primitives and tokens.

---

### Task 1: Global CSS Contract

**Files:**
- Create: `libs/client/shared/src/styles/global-css-contract.spec.ts`
- Modify: `libs/client/shared/src/styles/global.css`

**Interfaces:**
- Consumes: existing `global.css`.
- Produces: a Vitest contract that later tasks must keep green.

- [ ] **Step 1: Write the failing CSS boundary test**

Create `libs/client/shared/src/styles/global-css-contract.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(currentDir, 'global.css'), 'utf8');

describe('global.css design-system contract', () => {
  it('defines the semantic tokens consumed by shared UI', () => {
    const requiredTokens = [
      '--color-background',
      '--color-surface',
      '--color-surface-elevated',
      '--color-surface-muted',
      '--color-border',
      '--color-border-strong',
      '--color-text',
      '--color-text-muted',
      '--color-text-inverse',
      '--color-primary',
      '--color-primary-hover',
      '--color-primary-muted',
      '--color-danger',
      '--color-danger-muted',
      '--color-success',
      '--color-success-muted',
      '--color-warning',
      '--color-warning-muted',
      '--color-info',
      '--color-info-muted',
      '--shadow-surface',
      '--shadow-popover',
      '--shadow-focus',
    ];

    for (const token of requiredTokens) {
      expect(css).toContain(token);
    }
  });

  it('does not style app components through broad utility-class selectors', () => {
    const forbiddenSelectors = [
      'aside {',
      '.bg-primary\\/10',
      'button.bg-primary',
      'a.bg-primary',
      '.bg-primary.rounded-2xl',
      '.bg-primary.rounded-lg',
      '.bg-green-500',
      '.border-b.border-border',
      '.border-t.border-border',
      "[role='dialog']",
      '.modal-content',
    ];

    for (const selector of forbiddenSelectors) {
      expect(css).not.toContain(selector);
    }
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```bash
npm exec nx test @org/shared -- --run src/styles/global-css-contract.spec.ts
```

Expected: FAIL because `global.css` still contains forbidden selectors and missing semantic tokens.

- [ ] **Step 3: Replace `global.css` with the token/base boundary**

Modify `libs/client/shared/src/styles/global.css` so the top-level shape is:

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";

@theme {
  --color-black: #000000;
  --color-white: #ffffff;

  --color-background: #101114;
  --color-surface: #17191d;
  --color-surface-elevated: #202329;
  --color-surface-muted: #2a2e35;
  --color-border: #343944;
  --color-border-strong: #4a5260;
  --color-text: #f4f6f8;
  --color-text-muted: #a9b0bc;
  --color-text-inverse: #ffffff;

  --color-primary: #4f7cff;
  --color-primary-hover: #416ce5;
  --color-primary-muted: rgba(79, 124, 255, 0.14);
  --color-danger: #ef5b5b;
  --color-danger-muted: rgba(239, 91, 91, 0.14);
  --color-success: #35b979;
  --color-success-muted: rgba(53, 185, 121, 0.14);
  --color-warning: #d99a24;
  --color-warning-muted: rgba(217, 154, 36, 0.16);
  --color-info: #3aa6c7;
  --color-info-muted: rgba(58, 166, 199, 0.14);

  --shadow-surface: 0 10px 30px rgba(0, 0, 0, 0.24);
  --shadow-popover: 0 18px 45px rgba(0, 0, 0, 0.34);
  --shadow-focus: 0 0 0 3px rgba(79, 124, 255, 0.28);

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.625rem;
  --radius-xl: 0.75rem;

  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

.theme-light {
  --color-background: #f7f8fb;
  --color-surface: #ffffff;
  --color-surface-elevated: #f0f3f7;
  --color-surface-muted: #e6eaf0;
  --color-border: #d5dbe5;
  --color-border-strong: #b7c0cd;
  --color-text: #151922;
  --color-text-muted: #5b6472;
  --color-text-inverse: #ffffff;

  --color-primary: #315fdc;
  --color-primary-hover: #244db9;
  --color-primary-muted: rgba(49, 95, 220, 0.12);
  --color-danger: #c93636;
  --color-danger-muted: rgba(201, 54, 54, 0.12);
  --color-success: #16895a;
  --color-success-muted: rgba(22, 137, 90, 0.12);
  --color-warning: #9f6c12;
  --color-warning-muted: rgba(159, 108, 18, 0.14);
  --color-info: #167d99;
  --color-info-muted: rgba(22, 125, 153, 0.12);

  --shadow-surface: 0 8px 24px rgba(21, 25, 34, 0.08);
  --shadow-popover: 0 18px 45px rgba(21, 25, 34, 0.16);
  --shadow-focus: 0 0 0 3px rgba(49, 95, 220, 0.22);
}

em-emoji-picker {
  --rgb-background: 23, 25, 29;
  --rgb-color: 244, 246, 248;
  --rgb-accent: 79, 124, 255;
  --rgb-input: 32, 35, 41;
  --color-border: var(--color-border);
  --font-family: var(--font-sans);
  --border-radius: var(--radius-xl);
  --shadow: var(--shadow-popover);

  height: 400px;
  border: 1px solid var(--color-border);
}

.theme-light em-emoji-picker {
  --rgb-background: 255, 255, 255;
  --rgb-color: 21, 25, 34;
  --rgb-accent: 49, 95, 220;
  --rgb-input: 240, 243, 247;
}

[data-sonner-toaster] {
  --width: 360px;
  font-family: var(--font-sans) !important;
}

@layer base {
  html {
    background: var(--color-background);
  }

  body {
    @apply bg-background text-text font-sans;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::selection {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  *:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: 99px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
  }
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@layer utilities {
  .animate-fade-up {
    animation: fadeUp 0.2s ease-out both;
  }

  .animate-fade-in {
    animation: fadeIn 0.2s ease-out both;
  }

  .animate-shimmer {
    background: linear-gradient(
      90deg,
      var(--color-surface-elevated) 25%,
      var(--color-surface-muted) 50%,
      var(--color-surface-elevated) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.8s ease-in-out infinite;
  }
}
```

- [ ] **Step 4: Run the green contract test**

Run:

```bash
npm exec nx test @org/shared -- --run src/styles/global-css-contract.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run shared build**

Run:

```bash
npm exec nx build @org/shared
```

Expected: PASS. Tailwind should compile `bg-background`, semantic token classes, and the global CSS export.

- [ ] **Step 6: Commit**

```bash
git add libs/client/shared/src/styles/global.css libs/client/shared/src/styles/global-css-contract.spec.ts
git commit -m "refactor(shared): define global css token contract"
```

---

### Task 2: Shared Action And Field Primitives

**Files:**
- Modify: `libs/client/shared/src/ui/button/button.tsx`
- Modify: `libs/client/shared/src/ui/icon-button/icon-button.tsx`
- Modify: `libs/client/shared/src/ui/input/input.tsx`
- Modify: `libs/client/shared/src/ui/textarea/textarea.tsx`
- Modify: `libs/client/shared/src/ui/badge/badge.tsx`
- Modify: `libs/client/shared/src/ui/status-screen/status-screen.tsx`
- Test: existing stories/typecheck plus focused class assertions if current specs exist.

**Interfaces:**
- Consumes: semantic tokens from Task 1.
- Produces: stable shared primitives for messenger migration tasks.

- [ ] **Step 1: Review current WIP before editing**

Run:

```bash
git diff -- libs/client/shared/src/ui/button/button.tsx libs/client/shared/src/ui/icon-button/icon-button.tsx libs/client/shared/src/ui/input/input.tsx libs/client/shared/src/ui/textarea/textarea.tsx libs/client/shared/src/ui/badge/badge.tsx libs/client/shared/src/ui/status-screen/status-screen.tsx
```

Expected: no unrelated WIP in these files. If WIP exists, read it and preserve it.

- [ ] **Step 2: Update `Button` variants**

Change the `buttonVariants` base and variants in `libs/client/shared/src/ui/button/button.tsx` to:

```ts
const buttonVariants = cva(
  [
    'inline-flex min-h-9 items-center justify-center gap-2 rounded-md',
    'font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-[var(--shadow-surface)]',
        secondary: 'border border-border bg-surface text-text hover:bg-surface-elevated',
        ghost: 'text-text-muted hover:bg-surface-elevated hover:text-text',
        danger: 'bg-danger text-text-inverse hover:opacity-90',
      },
      size: {
        sm: 'min-h-8 px-3 text-xs',
        md: 'min-h-9 px-4 text-sm',
        lg: 'min-h-10 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);
```

- [ ] **Step 3: Update `IconButton` variants**

Change the `iconButtonVariants` base and variants in `libs/client/shared/src/ui/icon-button/icon-button.tsx` to:

```ts
const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-md',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-[var(--shadow-surface)]',
        secondary: 'border border-border bg-surface text-text hover:bg-surface-elevated',
        ghost: 'text-text-muted hover:bg-surface-elevated hover:text-text',
        danger: 'bg-danger text-text-inverse hover:opacity-90',
      },
      size: {
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-sm',
        md: 'h-9 w-9 text-base',
        lg: 'h-10 w-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);
```

- [ ] **Step 4: Update fields to use token-backed surfaces**

In `input.tsx`, set the `inputVariants` base to:

```ts
const inputVariants = cva(
  [
    'w-full rounded-md border bg-surface text-text placeholder:text-text-muted',
    'font-sans transition-colors outline-none',
    'focus:border-primary focus:ring-2 focus:ring-primary/30',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-2.5 text-base',
      },
      state: {
        default: 'border-border',
        error: 'border-danger focus:border-danger focus:ring-danger/30',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  },
);
```

Apply the same structure to `textareaVariants` in `textarea.tsx`, preserving `resize-none`.

- [ ] **Step 5: Update badge/status semantic classes**

In `badge.tsx`, update variants to:

```ts
variant: {
  primary: 'bg-primary text-text-inverse',
  surface: 'border border-border bg-surface text-text',
  danger: 'bg-danger-muted text-danger',
  muted: 'bg-surface-muted text-text-muted',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  info: 'bg-info-muted text-info',
},
```

Update `BadgeProps` type only if TypeScript does not infer new variants through `cva`.

In `status-screen.tsx`, replace `text-green-500` with `text-success` and `text-primary` info with `text-info`:

```ts
const variants = {
  error: { icon: '✕', color: 'text-danger' },
  success: { icon: '✓', color: 'text-success' },
  info: { icon: 'ℹ', color: 'text-info' },
} as const;
```

- [ ] **Step 6: Run shared typecheck and build**

Run:

```bash
npm exec nx typecheck @org/shared
npm exec nx build @org/shared
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/client/shared/src/ui/button/button.tsx libs/client/shared/src/ui/icon-button/icon-button.tsx libs/client/shared/src/ui/input/input.tsx libs/client/shared/src/ui/textarea/textarea.tsx libs/client/shared/src/ui/badge/badge.tsx libs/client/shared/src/ui/status-screen/status-screen.tsx
git commit -m "refactor(shared): standardize action and field primitives"
```

---

### Task 3: Shared Overlays, Toasts, And Viewer

**Files:**
- Modify: `libs/client/shared/src/ui/modal/modal.tsx`
- Modify: `libs/client/shared/src/ui/toast/toaster.tsx`
- Modify: `libs/client/shared/src/ui/media-viewer/media-viewer.tsx`
- Test: `libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx`

**Interfaces:**
- Consumes: `Button`, `IconButton`, `Text`, `Heading`, semantic tokens from Tasks 1-2.
- Produces: theme-aware overlay primitives for profile/media migration.

- [ ] **Step 1: Review current WIP before editing**

Run:

```bash
git diff -- libs/client/shared/src/ui/modal/modal.tsx libs/client/shared/src/ui/toast/toaster.tsx libs/client/shared/src/ui/media-viewer/media-viewer.tsx libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx
```

Expected: understand and preserve any existing WIP, especially `media-viewer.tsx` and its spec.

- [ ] **Step 2: Ensure media viewer test covers theme-aware chrome**

If `libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx` does not already assert theme-aware classes, add:

```ts
it('renders theme-aware chrome and shared control buttons', () => {
  render(
    <MediaViewer
      isOpen
      items={[
        { id: 'image-1', type: 'image', src: '/image-1.png', alt: 'First image', label: 'First' },
        { id: 'image-2', type: 'image', src: '/image-2.png', alt: 'Second image', label: 'Second' },
      ]}
      onClose={() => undefined}
    />,
  );

  expect(screen.getByTestId('media-viewer')).toHaveClass('bg-background/95');
  expect(screen.getByTestId('media-viewer-chrome')).toHaveClass('bg-surface');
  expect(screen.getByRole('button', { name: /close media viewer/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /previous media/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /next media/i })).toBeVisible();
});
```

- [ ] **Step 3: Run media viewer test**

Run:

```bash
npm exec nx test @org/shared -- --run src/ui/media-viewer/media-viewer.spec.tsx
```

Expected: PASS if WIP already satisfies it, otherwise FAIL before implementation.

- [ ] **Step 4: Update modal shell**

In `modal.tsx`, change the overlay and dialog classes in `ModalRoot` to:

```tsx
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
```

Keep existing escape handling, body scroll lock, context, and portal behavior.

- [ ] **Step 5: Update toast classNames**

In `toaster.tsx`, replace hardcoded white text/black shadow classes with:

```ts
toast: [
  'group flex w-full items-start gap-3',
  'rounded-lg border border-border bg-surface text-text',
  'px-4 py-3 shadow-[var(--shadow-popover)]',
  '!font-sans',
].join(' '),
title: 'text-sm font-semibold leading-snug text-text',
description: 'mt-0.5 text-sm leading-relaxed text-text-muted',
success: 'border-l-2 border-l-success',
error: 'border-l-2 border-l-danger',
warning: 'border-l-2 border-l-warning',
info: 'border-l-2 border-l-info',
closeButton: 'absolute right-2 top-2 text-text-muted transition-colors hover:text-text',
actionButton: 'rounded-md bg-primary px-2.5 py-1 text-xs text-text-inverse',
```

- [ ] **Step 6: Keep media viewer chrome token-based**

Ensure `media-viewer.tsx` uses:

```tsx
className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-3 text-text sm:p-6"
```

for the root, `bg-surface`, `border-border`, `Text`, and `IconButton` for chrome, and restrict hardcoded black to the media stage only:

```tsx
<div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-black">
```

- [ ] **Step 7: Run shared tests and build**

Run:

```bash
npm exec nx test @org/shared -- --run src/ui/media-viewer/media-viewer.spec.tsx
npm exec nx typecheck @org/shared
npm exec nx build @org/shared
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/client/shared/src/ui/modal/modal.tsx libs/client/shared/src/ui/toast/toaster.tsx libs/client/shared/src/ui/media-viewer/media-viewer.tsx libs/client/shared/src/ui/media-viewer/media-viewer.spec.tsx
git commit -m "refactor(shared): standardize overlay primitives"
```

---

### Task 4: Messenger Header, Footer, And Floating Actions

**Files:**
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-header/chat-header.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Test: app-level tests touching chat layout if present.

**Interfaces:**
- Consumes: `Button`, `IconButton`, `Text`, `Spinner`, semantic tokens.
- Produces: chat action surfaces that do not depend on removed global CSS hacks.

- [ ] **Step 1: Review current WIP before editing**

Run:

```bash
git diff -- libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-header/chat-header.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx
```

Expected: preserve existing WIP in `chat-header.tsx`; do not overwrite unrelated behavior.

- [ ] **Step 2: Import shared primitives where buttons are hand-styled**

Use imports like:

```ts
import { Button, IconButton, Spinner, Text } from '@org/shared';
```

Keep existing domain imports unchanged.

- [ ] **Step 3: Replace floating new-message button**

In `virtual-message-list.tsx`, replace the hand-styled `<button>` for `New messages` with:

```tsx
<Button
  type="button"
  size="sm"
  className="absolute bottom-6 right-6 z-10 rounded-full shadow-[var(--shadow-popover)]"
  onClick={scrollToBottom}
  leftIcon={
    <span aria-hidden="true" className="text-base leading-none">
      ↓
    </span>
  }
>
  New messages
</Button>
```

- [ ] **Step 4: Replace header icon-only buttons**

For back/menu/settings buttons in `chat-header.tsx`, use:

```tsx
<IconButton
  type="button"
  label="Back to chats"
  size="md"
  variant="ghost"
  className="md:hidden"
  onClick={onBack}
  icon={<ArrowLeft className="h-5 w-5" aria-hidden="true" />}
/>
```

Use the existing icon library if `lucide-react` is already imported in the file. If the file currently uses inline SVG, keep the same visual icon as `span`/existing SVG inside `IconButton` for this task and defer icon-library normalization.

- [ ] **Step 5: Replace composer action buttons**

In `ChatFooter.tsx`, replace circular hand-styled action buttons with `IconButton`. For primary send action:

```tsx
<IconButton
  type="submit"
  label="Send message"
  size="lg"
  variant="primary"
  disabled={!canSend}
  loading={isSending}
  icon={<SendIcon className="h-5 w-5" aria-hidden="true" />}
/>
```

For attach/emoji/voice/circle actions:

```tsx
<IconButton
  type="button"
  label="Attach file"
  size="lg"
  variant="ghost"
  onClick={openAttachMenu}
  icon={<AttachIcon className="h-5 w-5" aria-hidden="true" />}
/>
```

Preserve existing handlers and disabled logic.

- [ ] **Step 6: Replace recording/upload status text with `Text`**

Use:

```tsx
<Text as="span" size="sm" color="danger" weight="medium">
  Recording voice...
</Text>
```

and:

```tsx
<Text as="span" size="sm" color="muted" className="flex-1 truncate">
  {pendingFile.name}
</Text>
```

- [ ] **Step 7: Run messenger checks**

Run:

```bash
npm exec nx typecheck @org/pages-chat-page
npm exec nx build @org/messenger
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-header/chat-header.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx
git commit -m "refactor(client): align chat controls with shared ui"
```

---

### Task 5: Messenger Lists And Message Surfaces

**Files:**
- Modify: `libs/client/pages/messenger/pages-chats-layout/src/lib/chats-tab.tsx`
- Modify: `libs/client/pages/messenger/pages-chats-layout/src/lib/ui/sidebar/chat-list-sidebar/sidebar-content.tsx`
- Modify: `libs/client/entities/message/src/ui/message-bubble.tsx`
- Modify: `libs/client/entities/message/src/ui/file-message.tsx`
- Test: `apps/client/messenger/src/app/message-audio-rendering.spec.tsx`
- Test: `apps/client/messenger/src/app/message-file-rendering.spec.tsx`

**Interfaces:**
- Consumes: semantic tokens, `Text`, `Button`, `IconButton`, `Spinner`, `Badge`, `Skeleton`.
- Produces: chat list and message rendering that remain readable after global hacks are removed.

- [ ] **Step 1: Review current WIP before editing**

Run:

```bash
git diff -- libs/client/pages/messenger/pages-chats-layout/src/lib/chats-tab.tsx libs/client/pages/messenger/pages-chats-layout/src/lib/ui/sidebar/chat-list-sidebar/sidebar-content.tsx libs/client/entities/message/src/ui/message-bubble.tsx libs/client/entities/message/src/ui/file-message.tsx apps/client/messenger/src/app/message-audio-rendering.spec.tsx apps/client/messenger/src/app/message-file-rendering.spec.tsx
```

Expected: preserve current WIP in list/sidebar/message file tests.

- [ ] **Step 2: Update message bubble classes**

In `message-bubble.tsx`, replace mine/not-mine classes with token-backed variants:

```tsx
className={cn(
  'min-w-0 max-w-[min(82vw,32rem)] px-4 py-2.5 text-sm sm:max-w-[70%]',
  'rounded-lg border shadow-[var(--shadow-surface)]',
  isMine
    ? 'border-primary bg-primary text-text-inverse rounded-br-sm lg:rounded-bl-sm'
    : 'border-border bg-surface text-text rounded-bl-sm',
)}
```

Use `text-text-inverse/70` for timestamps inside own messages and `text-text-muted` for received messages.

- [ ] **Step 3: Update file/audio cards**

In `file-message.tsx`, replace hardcoded `text-white`, `bg-white/10`, `border-white/20`, and ad hoc black overlays where they represent app chrome. Use:

```ts
isMine ? 'border-primary/30 bg-primary-muted text-text-inverse' : 'border-border bg-surface text-text'
```

For media content overlays that sit directly on images/video, keep `bg-black/55 text-white` because it protects media readability rather than app chrome.

- [ ] **Step 4: Update chat list/sidebar text and buttons**

In `chats-tab.tsx` and `sidebar-content.tsx`, replace repeated plain text nodes with `Text` where they are content/status labels:

```tsx
<Text size="sm" color="muted" className="text-center py-4">
  No chats found
</Text>
```

Use `Button`/`IconButton` for create/search/navigation actions and leave list row containers as layout markup.

- [ ] **Step 5: Run focused app tests**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand message-audio-rendering.spec.tsx message-file-rendering.spec.tsx
```

Expected: PASS. If Jest file matching does not accept both names together, run each file separately through the same Nx target.

- [ ] **Step 6: Run build**

Run:

```bash
npm exec nx build @org/messenger
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/client/pages/messenger/pages-chats-layout/src/lib/chats-tab.tsx libs/client/pages/messenger/pages-chats-layout/src/lib/ui/sidebar/chat-list-sidebar/sidebar-content.tsx libs/client/entities/message/src/ui/message-bubble.tsx libs/client/entities/message/src/ui/file-message.tsx apps/client/messenger/src/app/message-audio-rendering.spec.tsx apps/client/messenger/src/app/message-file-rendering.spec.tsx
git commit -m "refactor(client): align chat lists and messages with shared ui"
```

---

### Task 6: Profile Modal And Media Panel Migration

**Files:**
- Modify: `libs/client/features/user-profile/src/ui/user-profile-modal.tsx`
- Modify: `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`
- Modify: `apps/client/messenger/src/test-stubs/shared.tsx`
- Test: `apps/client/messenger/src/app/user-profile-modal.spec.tsx`

**Interfaces:**
- Consumes: `Modal`, `Button`, `IconButton`, `Badge`, `Text`, `Heading`, `Spinner`, `Skeleton`, `MediaViewer`.
- Produces: profile/media modal surfaces consistent with shared UI.

- [ ] **Step 1: Review current WIP and prior plan**

Run:

```bash
git diff -- libs/client/features/user-profile/src/ui/user-profile-modal.tsx libs/client/features/user-profile/src/ui/profile-media-panel.tsx apps/client/messenger/src/test-stubs/shared.tsx apps/client/messenger/src/app/user-profile-modal.spec.tsx docs/superpowers/plans/2026-07-20-profile-media-modal-ui.md
```

Expected: preserve existing WIP and reconcile with `docs/superpowers/plans/2026-07-20-profile-media-modal-ui.md` instead of replacing it blindly.

- [ ] **Step 2: Ensure shared test stub exports consumed primitives**

In `apps/client/messenger/src/test-stubs/shared.tsx`, ensure these exports exist for app Jest tests:

```tsx
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
    <div role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  );
}

Modal.Header = function ModalHeader({ title, children }: { title?: string; children?: ReactNode }) {
  return <div>{title ? <h2>{title}</h2> : children}</div>;
};

Modal.Body = function ModalBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};
```

Preserve existing stubs for `Button`, `IconButton`, `Text`, `Heading`, `Badge`, `Skeleton`, `Spinner`, `MediaViewer`, and API utilities.

- [ ] **Step 3: Refactor profile modal shell**

In `user-profile-modal.tsx`, use shared shell:

```tsx
<Modal isOpen onClose={onClose} className="max-w-lg">
  <Modal.Header title="Profile" />
  <Modal.Body className="space-y-5">
    {/* existing profile content */}
  </Modal.Body>
  {showSendButton && (
    <Modal.Footer>
      <Button loading={creatingChat} onClick={handleCreateChat}>
        Send message
      </Button>
    </Modal.Footer>
  )}
</Modal>
```

Keep existing data fetching, create-chat behavior, tab state, and media panel wiring.

- [ ] **Step 4: Refactor profile media panel filters/loading**

In `profile-media-panel.tsx`, use shared text and loading:

```tsx
<div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border pb-3">
  {filters.map((filter) => (
    <Button
      key={filter.value}
      type="button"
      size="sm"
      variant={activeFilter === filter.value ? 'primary' : 'secondary'}
      onClick={() => setActiveFilter(filter.value)}
    >
      {filter.label}
    </Button>
  ))}
</div>
```

Use:

```tsx
<Spinner color="primary" />
<Text size="sm" color="muted">No media found</Text>
```

for loading and empty states.

- [ ] **Step 5: Run focused profile modal test**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand user-profile-modal.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Run feature/app checks**

Run:

```bash
npm exec nx typecheck @org/features-user-profile
npm exec nx build @org/messenger
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/client/features/user-profile/src/ui/user-profile-modal.tsx libs/client/features/user-profile/src/ui/profile-media-panel.tsx apps/client/messenger/src/test-stubs/shared.tsx apps/client/messenger/src/app/user-profile-modal.spec.tsx
git commit -m "refactor(client): align profile media surfaces with shared ui"
```

---

### Task 7: Final Verification And Visual Smoke

**Files:**
- Modify only if a verification failure identifies a specific defect.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified app build and a clean final diff.

- [ ] **Step 1: Run shared verification**

Run:

```bash
npm exec nx test @org/shared
npm exec nx typecheck @org/shared
npm exec nx build @org/shared
```

Expected: all PASS.

- [ ] **Step 2: Run messenger verification**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand
npm exec nx typecheck @org/messenger
npm exec nx build @org/messenger
```

Expected: all PASS.

- [ ] **Step 3: Run console-policy grep**

Run:

```bash
rg -n "console\\." apps/client/messenger libs/client -g '!**/use-logger.ts' -g '!**/*.spec.*' -g '!**/test-stubs/**'
```

Expected: no direct production client `console.*` output.

- [ ] **Step 4: Run visual smoke where feasible**

If a local dev server is already available, open messenger in desktop and mobile viewports and inspect:

```bash
npm exec nx serve @org/messenger
```

Expected visual checks:

- light and dark theme text is readable on `background`, `surface`, `surface-elevated`, own-message, received-message, modal, toast, and media viewer surfaces;
- no global gradient/glow hacks are visible on unrelated components;
- buttons and icon buttons keep stable dimensions;
- modal and media viewer chrome use app tokens while media content remains inspectable.

- [ ] **Step 5: Route verification failures back to the owning task**

If Step 1-4 fails, do not create a broad verification commit. Return to the task that owns the failing file and repeat that task's test cycle and commit step. If all checks pass, do not create an empty commit.

---

## Self-Review

- Spec coverage: Task 1 defines the complete semantic token set and removes broad global overrides. Tasks 2-3 update shared primitives. Tasks 4-6 migrate high-impact messenger surfaces. Task 7 verifies tests, builds, console policy, and visual readability.
- Placeholder scan: this plan contains no incomplete markers and no empty implementation steps.
- Type consistency: all shared imports referenced in migration tasks are exported from `@org/shared` or explicitly added to app test stubs.
