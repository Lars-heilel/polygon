# Media Service Specification

## Purpose

The Media Service owns MinIO-backed upload authorization, file metadata, protected content delivery, media histories, avatar media, and reference-aware deletion.

## Implemented Capabilities

- Initializes uploads with storage data for direct client upload.
- Confirms an upload and changes its metadata state from `PENDING` to `READY`.
- Streams content through protected media endpoints.
- Restricts chat attachment access to chat members.
- Returns user, chat, and avatar media histories.
- Supports avatar upload, assignment, history, and deletion flows.
- Deletes a file only after atomic reference checks confirm it is not still required by messages or other protected references.

## Runtime Contracts

- The client uploads media directly to MinIO using the initialized storage data; the gateway does not proxy the file body.
- A confirmed file has `READY` metadata before it can be used by message and profile surfaces.
- Media content and history endpoints enforce their corresponding user or chat authorization.
- The client categorizes ready media as image, video, audio, voice, circle, or document for rendering.

## Acceptance Criteria

- **MEDIA-1:** Upload initialization returns storage data that a client can use to upload and then confirm media.
- **MEDIA-2:** Authorized confirmed media is rendered by category: image, video, audio, voice, circle, or document.
- **MEDIA-3:** Voice messages hide raw filenames and use a stable waveform layout in the Messenger SPA.
- **MEDIA-4:** A file with active references is not deleted through a history or content-management surface.
- **MEDIA-5:** Avatar and chat-media history responses contain only media authorized for the requesting user.

## Exclusions

The current backend does not provide asynchronous thumbnail, waveform, or video-preview generation, orphan cleanup, or automatic cascade deletion of media after message deletion. Waveforms and media viewers described here are client rendering behavior.
