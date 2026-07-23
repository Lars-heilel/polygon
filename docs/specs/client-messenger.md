# Messenger SPA Specification

## Purpose

The Messenger SPA is the React client for account access, real-time direct messaging, media playback and viewing, profile/settings management, session-device management, and user-facing settings.

## Implemented Capabilities

- Auth bootstrap redirects an unauthenticated visitor to login and uses cookie-based refresh behavior for an expired access session.
- Provides login, registration, OAuth entry points, email verification, password recovery, profile editing, and session-device management.
- Lists direct and saved-message chats with last-message previews, unread counters, basic online/offline state, and typing indicators.
- Renders cursor-paginated message history with skeleton fallbacks while chat header or message content loads.
- Sends text and uploads attachments with optimistic client updates; supports voice recording and mobile circle-video recording preview.
- Provides edit, delete, copy, and forward actions. Forwarded messages show their source-author context.
- Renders link previews, images and videos in viewers, circle videos with mute/viewer controls, document download cards, waveform voice messages, and global-player audio.
- Provides a compact global audio player with previous/next queue navigation.
- Provides chat and profile media panels, avatar history carousel, profile modal, dark/light theme settings, and notification settings.
- Uses responsive layouts and controls for chat, recording, avatar history, and audio playback across supported desktop and mobile viewports.

## Runtime Contracts

- TanStack Query owns server-data caching and optimistic reconciliation; Zustand owns client interaction state such as session, active chat, and notification settings.
- The authenticated socket connects after session bootstrap and applies real-time message, edit, delete, read, presence, and typing updates.
- The browser does not retain access or refresh tokens in JavaScript application state.
- Media controls consume confirmed media URLs and client rendering metadata; they do not require a server-generated thumbnail, waveform, or video preview.

## Acceptance Criteria

- **CLIENT-1:** Auth bootstrap redirects an unauthenticated user to login.
- **CLIENT-2:** Chat-list previews identify message/media types and show unread counters.
- **CLIENT-3:** The chat footer supports text, file upload, voice recording, and mobile circle recording preview.
- **CLIENT-4:** Message actions support edit, delete, copy, and forward.
- **CLIENT-5:** The global compact audio player supports previous and next queue navigation.
- **CLIENT-6:** Profile, avatar history, settings, device management, and dark/light themes are available.
- **CLIENT-7:** Message-list and chat-header skeletons provide stable loading fallbacks.
- **CLIENT-8:** Image/video viewers, circle playback, document cards, and waveform voice rendering use the corresponding media category.

## Exclusions

Calls, group chats, group calls, offline/PWA caching or installation, internationalization, message search, last-seen, custom statuses, user blocking, and guaranteed browser push delivery are not current Messenger SPA behavior.
