# Chat Bottom Sentinel Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat scroll-to-bottom stable by using a real bottom sentinel as the source of truth.

**Architecture:** Keep `react-virtuoso` as the virtualization engine. Add a bottom sentinel in the Virtuoso footer, track its visibility, and make all scroll-to-bottom actions retry until that sentinel is visible or a bounded retry budget is exhausted.

**Tech Stack:** React 19, react-virtuoso, Playwright, Jest, Nx.

## Global Constraints

- Do not replace `react-virtuoso`.
- Do not change backend unread/read-marker behavior.
- Preserve reader position for incoming messages when the user is reading older history.
- Always scroll to the real bottom after the current user sends a message.
- Use TDD: write failing tests before implementation.
- Use Nx through `npm exec nx -- ...` with `NX_ISOLATE_PLUGINS=false`.

---

### Task 1: Add Sentinel E2E Coverage

**Files:**
- Modify: `apps/client/messenger/e2e/chat-scroll-layout.spec.ts`

**Interfaces:**
- Produces: Playwright coverage for `data-testid="chat-bottom-sentinel"` visibility.

- [x] **Step 1: Add failing initial-bottom sentinel expectations**

Update existing scroll-layout tests so the latest-message assertions also check that `chat-bottom-sentinel` is visible.

- [x] **Step 2: Add failing New Messages button sentinel test**

Add a test that scrolls up, clicks `New messages`, and expects `chat-bottom-sentinel` to become visible.

- [x] **Step 3: Run red e2e**

Run: `env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/messenger:e2e-ci--e2e/chat-scroll-layout.spec.ts -- --project=chromium-desktop -g "sentinel|opens at latest"`

Expected: FAIL because the sentinel does not exist.

### Task 2: Implement Bottom Sentinel Controller

**Files:**
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`

**Interfaces:**
- Produces: `data-testid="chat-bottom-sentinel"` footer element.
- Produces: `scrollToBottomUntilSettled(behavior: ScrollBehavior): void`.

- [x] **Step 1: Add sentinel refs and observer state**

Add refs for the sentinel, observer, retry frame, and bottom visibility.

- [x] **Step 2: Replace direct scroll-to-bottom calls**

Replace direct `scrollToIndex('LAST')` calls with `scrollToBottomUntilSettled`.

- [x] **Step 3: Use sentinel visibility for bottom button**

Drive `isAtBottom` from sentinel visibility, keeping Virtuoso `atBottomStateChange` only as fallback support.

- [x] **Step 4: Run green focused e2e**

Run: `env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/messenger:e2e-ci--e2e/chat-scroll-layout.spec.ts -- --project=chromium-desktop -g "sentinel|opens at latest"`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Verify only.

- [x] **Step 1: Run full scroll-layout e2e**

Run: `env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/messenger:e2e-ci--e2e/chat-scroll-layout.spec.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck/lint**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/pages-chat-page
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/pages-chat-page
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand
```

Expected: PASS.
