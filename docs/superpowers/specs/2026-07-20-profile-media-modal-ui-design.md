# Profile And Media Modal UI Design

## Goal

Bring profile and media modal experiences back in line with the application UI system while improving the user flows they exist for:

- quickly understand who a chat participant is;
- quickly find media shared in a chat;
- comfortably preview image and video media without losing chat context.

This is not only a color cleanup. The fix should make the modals behave like first-class app surfaces in both light and dark themes, and should reuse existing shared UI primitives where they already cover the interaction.

## Current Problems

`UserProfileModal` manually implements portal, overlay, dialog shell, header, close button, loading skeletons, footer tabs, and primary action styling. Other app dialogs already use `@org/shared` `Modal`, `Button`, `IconButton`, `Text`, `Heading`, `Spinner`, and `Skeleton`, so the profile modal visually drifts from the rest of the product.

`MediaViewer` is shared, but it behaves like a separate black media overlay rather than an app-owned viewer. It hardcodes black and white chrome, custom navigation buttons, fixed desktop spacing, and hand-written SVG controls. That makes dark/light theme behavior inconsistent and creates risk on mobile viewports.

`ProfileMediaPanel` is functionally useful, but its filter tabs, entry cards, sticky headers, loading states, and media previews are styled locally. These should remain optimized for scanning chat media, but use the same theme tokens and shared primitives as the rest of the app.

## User Scenarios

### Profile Context

When a user opens a profile from chat, they are usually checking context, not navigating away. The modal should therefore be compact and calm:

- show avatar, display name, username, role, bio, and email clearly;
- keep the close affordance in the expected shared modal position;
- expose "Send message" as the primary action when available;
- avoid decorative treatments that compete with the chat;
- preserve scrollability for long bios and small mobile screens.

### Chat Media Search

When a user opens the media tab, they are scanning old attachments. The panel should prioritize:

- fast filter switching across all, photo, video, audio, docs, and links;
- readable grouping by date;
- compact entries with sender and time;
- clear visual preview for images/videos;
- stable scrolling and no horizontal overflow on mobile.

### Media Preview

When a user opens image or video media, they want the content to be large and unobstructed. Fullscreen preview remains correct, but the surrounding controls should still feel like the app:

- media stays centered and maximized within safe viewport bounds;
- close, previous, and next controls are accessible and easy to tap;
- caption and item count use theme-aware surfaces and text;
- keyboard controls keep working: Escape, ArrowLeft, ArrowRight;
- click outside closes the viewer without interfering with media controls.

## Recommended Approach

Use a focused shared-primitive alignment:

1. Refactor `UserProfileModal` to use `Modal` from `@org/shared` for portal, overlay, shell, escape handling, and outside click handling.
2. Keep profile and media tab content local to `@org/features-user-profile`, but style it with app tokens and existing shared primitives.
3. Update `ProfileMediaPanel` styles and loading states to use shared `Spinner`, `Text`, and consistent surface/border tokens.
4. Update shared `MediaViewer` once so every caller benefits: message images, video messages, circle videos, profile media previews, and any future viewer usage.

Do not introduce a new modal framework or a new design-system layer in this task. If a reusable segmented control or media dialog abstraction is needed later, it can be added after the current drift is removed.

## Component Design

### UserProfileModal

- Render with:
  - `Modal isOpen={true}`;
  - `Modal.Header title="Profile"`;
  - `Modal.Body` as a flex column with `min-h-0`;
  - `Modal.Footer` only for the profile/media tab switcher when `chatId` exists.
- Use `Skeleton` for profile loading placeholders.
- Use `Text` and `Heading` for labels and profile content.
- Use `Button` for "Send message" with `loading={creatingChat}`.
- Keep `AvatarCarousel` behavior unchanged, but ensure it still layers above or closes independently without breaking the parent modal.
- Avoid hardcoded black/white text except where media contrast requires it.
- Avoid gradients for role badges; use `Badge variant="primary"` or an existing theme-safe variant.

### ProfileMediaPanel

- Keep the current API: `ProfileMediaPanel({ chatId })`.
- Keep the current media filters and data flow.
- Restyle filter buttons as compact segmented controls using theme tokens:
  - selected: primary or primary-soft treatment;
  - unselected: surface-elevated with muted text;
  - no custom glass or one-off visual language.
- Use `Spinner` for loading and pagination loading.
- Use compact cards with consistent radius and border from the shared surface system.
- Keep visual previews large enough to inspect, but constrain them responsively.
- Ensure sticky date headers use a modal-compatible surface token so they work in both themes.

### MediaViewer

- Keep the public API:
  - `isOpen`;
  - `items`;
  - `initialIndex`;
  - `onClose`.
- Keep fullscreen preview for images and videos.
- Replace custom button styling with shared `IconButton` where possible.
- Use theme tokens for toolbar, captions, borders, and text.
- The media stage may use a dark neutral backdrop for content contrast, but chrome should not be a hardcoded foreign UI.
- Make spacing responsive:
  - mobile should use small safe padding;
  - desktop can use larger side space for navigation controls.
- Preserve Embla carousel behavior and keyboard handling.

## Non-Goals

- Do not change media fetching APIs.
- Do not change chat media grouping or filtering semantics.
- Do not redesign profile pages outside the modal.
- Do not replace Embla carousel.
- Do not replace existing shared `Modal`.
- Do not change backend or upload behavior.

## Testing Requirements

Add focused component coverage where practical:

- `UserProfileModal` renders loading, error, loaded profile, profile/media tab switch, and send-message action.
- `MediaViewer` opens at the requested index, closes by button and Escape, navigates previous/next, and renders caption/count.
- Existing message rendering tests continue passing with the updated shared viewer.

Add or extend e2e smoke only if component tests cannot cover the actual user behavior, especially mobile viewer layout or profile media tab interaction.

## Acceptance Criteria

- Profile modal uses shared modal shell and no longer manually owns overlay/dialog portal behavior.
- Profile and media modal surfaces respect light and dark theme tokens.
- Media viewer remains comfortable for image/video preview while using app-consistent controls and responsive spacing.
- Existing image, video, circle, and profile media preview flows still open and close correctly.
- Component tests and relevant Nx lint/typecheck targets pass.
