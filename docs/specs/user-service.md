# User Service Specification

## Purpose

The User Service owns account profile data used by profile views, user search results, chat headers, and message presentation.

## Implemented Capabilities

- Creates a profile for a registered account.
- Returns the authenticated user's profile and public profile data for other users.
- Updates profile fields and avatar state.
- Provides profile information for direct-chat creation, chat presentation, and administrative account detail.
- Exposes avatar state used by avatar-history and media surfaces.

## Runtime Contracts

- Current-user operations are available only through a valid active gateway session.
- Public-profile responses contain the data needed to display a person in profile and chat contexts without exposing session data.
- Avatar references are user-owned media; changing or removing an avatar updates the profile state used by the client.

## Acceptance Criteria

- **USER-1:** The current user profile is returned only through a valid active session.
- **USER-2:** Public profile data is available for chat and profile display.
- **USER-3:** Profile updates are reflected in the client profile and chat presentation.
- **USER-4:** Avatar state used by a profile or chat header belongs to that displayed user and does not fall back to the current user's avatar.

## Exclusions

The current product provides basic Socket.IO online/offline presence, but it does not provide last-seen values, custom availability statuses, user blocking, or a guaranteed initials-avatar fallback.
