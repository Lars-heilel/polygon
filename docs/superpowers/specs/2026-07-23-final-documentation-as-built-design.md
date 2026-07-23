# Final As-Built Documentation Pass Design

## Goal

Convert the repository documentation into an English, final-state documentation set that describes the current implemented Polygon system. Product-facing specs and the README must no longer read like a roadmap. They must describe the delivered behavior and acceptance criteria for the application as it exists now.

## Scope

Primary rewrite targets:

- `README.md`
- `docs/specs/*.md`

Engineering documentation targets:

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/MONOREPO_GOTCHAS.md`
- `docs/OBSERVABILITY.md`
- `docs/SETUP.md`

Engineering documents remain operational references. They should be translated and corrected where stale, but their working rules, gotchas, setup details, observability contracts, and architecture constraints must remain intact.

## Backup Requirement

Before changing engineering documentation, preserve the current engineering docs under `docs/oldDocs/`.

The backup must include:

- `ARCHITECTURE.md`
- `DEVELOPMENT.md`
- `MONOREPO_GOTCHAS.md`
- `OBSERVABILITY.md`
- `SETUP.md`

The backup exists so future maintenance can compare the final English documentation against the previous engineering baseline if development resumes. Product specs do not need backup copies because the goal is to replace roadmap/spec drift with the final as-built contract.

## Non-Goals

- No application code changes.
- No new feature promises.
- No future roadmap sections.
- No documentation for calls, groups, offline PWA, i18n, or other non-implemented capabilities as final product behavior.
- No restoration or modification of pre-existing deleted `docs/superpowers/...` files unless explicitly requested.

## Documentation Model

The final docs use two different roles:

1. Product contract docs:
   - `README.md`
   - `docs/specs/*.md`
   - These describe implemented features, acceptance criteria, constraints, and final behavior.

2. Engineering reference docs:
   - `docs/ARCHITECTURE.md`
   - `docs/DEVELOPMENT.md`
   - `docs/MONOREPO_GOTCHAS.md`
   - `docs/OBSERVABILITY.md`
   - `docs/SETUP.md`
   - These describe how the system works and how to safely operate or maintain it.

## As-Built Sources

The documentation pass should use implementation evidence from:

- Current source code in `apps/` and `libs/`
- Existing unit, integration, and e2e specs
- Recent commits:
  - `fix(gateway): enforce revoked sessions on private routes`
  - `fix(messenger): repair media message interactions`
  - recent chat media, forwarded message, and attachment commits
- Current Nx project graph and package boundaries

## Rewrite Rules

- Translate user-facing documentation to clear English.
- Replace `In development`, `planned`, `todo`, and similar roadmap phrasing with final-state wording.
- Remove or explicitly exclude features that are not implemented.
- Keep implemented advanced behavior in specs, including:
  - session management and session revocation
  - direct/self chats
  - text, media, file, voice, audio, video, and circle messages
  - forwarded messages with original-author snapshots
  - edit/delete message flows
  - link previews
  - unread counters and real-time socket updates
  - compact global audio player and queue controls
  - profile, avatar history, settings, dark/light themes
  - media upload and chat media rendering
  - admin account/session/ban controls where implemented
- Preserve operational cautions in engineering docs even if they mention future maintenance.

## Validation

After the documentation update, run text checks for stale roadmap and non-English drift. Suggested searches:

- Russian Cyrillic in docs that are expected to be English
- `planned`
- `todo`
- `in development`
- `надо`
- `в разработке`
- `будущее`

The checks should be reviewed contextually. A term may remain only if it is part of a quoted historical backup under `docs/oldDocs/`.

## Commit Strategy

Use separate commits:

1. Design spec commit.
2. Documentation rewrite commit after implementation and verification.

Do not mix the existing deleted `docs/superpowers/...` files into the documentation rewrite commit unless the user explicitly asks to include those deletions.
