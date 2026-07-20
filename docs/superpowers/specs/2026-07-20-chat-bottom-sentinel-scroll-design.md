# Chat Bottom Sentinel Scroll Design

## Problem

Chat scroll-to-bottom is unstable across normal chat flows. The current implementation relies on `react-virtuoso` signals and imperative `scrollToIndex({ index: 'LAST' })` calls. That is logically close to correct, but not physically stable once item heights change after render.

Observed failure modes:

- Opening or switching a chat can leave the viewport near, but not at, the latest message.
- Sending an own message scrolls with delay and may stop at different offsets depending on content type.
- Incoming messages have the same instability when the user is already near bottom.
- Message types with dynamic layout, such as audio waveforms, video, images, and other media, can change measured height after the first scroll attempt.

The missing primitive is a real bottom anchor. The app needs to know whether the rendered bottom of the list is actually visible, not only whether Virtuoso believes the last item is targeted.

## Goals

- Make "at bottom" mean "the bottom sentinel is visible in the scroll viewport".
- Preserve current reader behavior: if the user scrolls up to read older messages, incoming messages must not move their position.
- Always scroll to the real bottom after the current user sends a message.
- Keep Virtuoso responsible for virtualization, item measurement, and prepending older pages.
- Avoid infinite timers or fragile arbitrary delays.
- Cover the behavior with Playwright tests around initial open, own send, incoming messages, and mixed message types.

## Non-Goals

- Replace `react-virtuoso`.
- Rewrite message pagination or prepend behavior.
- Change unread/read-marker backend behavior.
- Change visual design of message bubbles or composer.
- Autoscroll incoming messages while the user is reading older history.

## Current Architecture

`VirtualMessageList` currently uses:

- `initialTopMostItemIndex={allMessages.length - 1}`
- `followOutput={(bottom) => (bottom ? 'smooth' : false)}`
- `atBottomStateChange` to maintain `isAtBottom`
- `scrollToIndex({ index: 'LAST', align: 'end' })` for button clicks, chat switches, and own messages
- a static footer spacer

This gives no direct signal that the actual bottom of the scrollable content is visible after all layout work is complete.

## Proposed Architecture

Add a real bottom sentinel to the Virtuoso footer:

```tsx
components={{
  Footer: () => (
    <>
      <div className="h-6" />
      <div data-testid="chat-bottom-sentinel" ref={bottomSentinelRef} />
    </>
  ),
}}
```

Track sentinel visibility with `IntersectionObserver` using the Virtuoso scroll container as the observer root.

The scroll controller should maintain three separate concepts:

- `isBottomVisible`: the sentinel is currently visible.
- `shouldStickToBottom`: the list is allowed to keep forcing the real bottom into view.
- `hasUnreadBelow`: the user is reading older messages and newer messages exist below the viewport.

Virtuoso remains the virtualization engine. The sentinel controller only decides when and how to verify bottom visibility.

## Scroll Behavior

### Initial Open And Chat Switch

When a chat first renders or `chatId` changes:

1. Mark `shouldStickToBottom = true`.
2. Call `scrollToBottomUntilSettled('auto')`.
3. Retry for a bounded number of animation frames until the sentinel is visible.
4. Stop retries once visible or when the retry budget is exhausted.

This handles delayed item measurement after the initial render.

### Own Sent Message

When `message:new` belongs to the current user and current chat:

1. Mark `shouldStickToBottom = true`.
2. Clear `hasUnreadBelow`.
3. Call `scrollToBottomUntilSettled('smooth')`.

Own messages always force the real bottom, even if the user was previously scrolled up.

### Incoming Message While At Bottom

When an incoming message belongs to the current chat and the bottom sentinel was visible before the append:

1. Keep `shouldStickToBottom = true`.
2. Call `scrollToBottomUntilSettled('smooth')`.
3. Keep `hasUnreadBelow = false`.

### Incoming Message While Reading Older Messages

When an incoming message belongs to the current chat and the bottom sentinel was not visible before the append:

1. Keep `shouldStickToBottom = false`.
2. Do not call scroll-to-bottom.
3. Set `hasUnreadBelow = true`.
4. Show the existing `New messages` button.

This preserves reader position.

### Manual Scroll Up

When the sentinel leaves the viewport because of user scrolling:

1. Set `isBottomVisible = false`.
2. Set `shouldStickToBottom = false`.
3. Show `New messages` only when `hasUnreadBelow` is true or when the current UI wants a manual bottom affordance.

### New Messages Button

Clicking `New messages`:

1. Mark `shouldStickToBottom = true`.
2. Clear `hasUnreadBelow`.
3. Call `scrollToBottomUntilSettled('smooth')`.

## Scroll-To-Bottom Algorithm

`scrollToBottomUntilSettled(behavior)` should:

1. Call Virtuoso `scrollToIndex({ index: 'LAST', align: 'end', behavior })`.
2. On the next animation frame, check if the sentinel is visible.
3. If visible, stop.
4. If not visible and the retry budget remains, call `scrollToIndex` again.
5. Continue for a small bounded budget, for example 8-12 frames.
6. If `IntersectionObserver` or the sentinel is unavailable, perform one fallback `scrollToIndex`.

Retry is only active while `shouldStickToBottom` is true. If the user scrolls away during the retry window, the loop stops.

## Dynamic Layout Changes

Dynamic media can change row height after the first scroll:

- image decode
- video metadata
- audio waveform initialization
- font/layout reflow

The sentinel design handles this without per-message special cases. If `shouldStickToBottom` is true and the sentinel becomes hidden due to a resize, the controller runs `scrollToBottomUntilSettled('auto')` again.

Implementation can subscribe through one of these mechanisms:

- Virtuoso range/resize callbacks if already available and reliable.
- A small `ResizeObserver` on the scroll content wrapper.
- A bounded follow-up retry after append/open, which may be enough for the first implementation.

The first implementation should prefer the smallest mechanism that passes the e2e tests.

## Error Handling And Fallbacks

- If `IntersectionObserver` is not available, keep current Virtuoso behavior as fallback.
- If the scroll container cannot be found, keep current Virtuoso behavior as fallback.
- If the sentinel never becomes visible within the retry budget, stop retrying and leave diagnostic state testable through DOM only in development if needed.
- No production console logging should be added for scroll decisions.

## Testing Plan

Add or extend Playwright tests in `apps/client/messenger/e2e/chat-scroll-layout.spec.ts`.

Required e2e coverage:

- Initial open shows latest row and `chat-bottom-sentinel` is visible.
- Switching/opening a chat with mixed message types settles with sentinel visible.
- Clicking `New messages` scrolls until sentinel is visible.
- Sending own text message scrolls until sentinel is visible.
- Sending own file/media message scrolls until sentinel is visible.
- Incoming message while user is reading older history preserves `scrollTop` and shows `New messages`.
- Latest `TEXT`, long text, `IMAGE`, `AUDIO`, `VOICE`, `VIDEO`, `CIRCLE`, and `FILE` remain fully visible above the composer with sentinel visible.

Optional unit coverage:

- Extract a small scroll decision helper and test transitions for `own message`, `incoming at bottom`, `incoming while reading`, and `manual button`.

## Acceptance Criteria

- "At bottom" UI state is driven by bottom sentinel visibility.
- Own sent messages always settle to the real bottom.
- Incoming messages do not move users who are reading older history.
- The scroll-to-bottom button settles the sentinel into view.
- Existing virtualization and older-message fetching behavior remains intact.
- Existing scroll-layout e2e tests pass.
- New sentinel-specific e2e tests pass on desktop and mobile where applicable.
