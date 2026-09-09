# Landing Page Design — Polygon Messenger

Date: 2026-09-09
Status: approved approach A, awaiting spec review
Scope: public landing at `/landing` + full noindex

## 1. Goal

Create a minimal mobile-first landing for the Polygon messenger app with sections
header / hero / stack / footer. Assemble only from existing `@org/shared`
primitives (especially `Heading`/`Text`), keep semantics valid, and hide the page
from indexing except via a direct link.

Success criteria:
- Route `/landing` renders without auth, mobile-first, no horizontal scroll at 360px.
- Exactly one `h1`, section `h2`s, landmark elements `header`/`main`/`footer`.
- No new design tokens or duplicated button/typography styles.
- `GET /robots.txt` returns `User-agent: *` + `Disallow: /`.
- Landing sets `noindex, nofollow, noarchive` and adds no sitemap entries.

## 2. Architecture

New FSD mini-package (per `docs/ARCHITECTURE.md` client composition and
`docs/DEVELOPMENT.md` module boundaries):

```text
libs/client/pages/system/pages-landing/
  package.json            # name @org/pages-landing, tags layer:pages scope:client
  src/index.ts            # export { LandingPage }
  src/lib/landing-page.tsx
  src/lib/sections/landing-header.tsx
  src/lib/sections/landing-hero.tsx
  src/lib/sections/landing-stack.tsx
  src/lib/sections/landing-footer.tsx
  src/lib/landing-page.spec.tsx
```

Route wiring in `apps/client/messenger/src/app/router/router.tsx`:
- Index `/` lives inside `GuestGuard` and lazy-renders `LandingPage`: guests see
  the landing as the start page, authenticated users are redirected to `/chats`
  by the guard, loading state shows the guard spinner.
- Public alias `path: '/landing'` (same lazy `LandingPage`) for share-by-link.
- Both are siblings of `GuestGuard`/`AppGuard` scope ( NOT inside `AppGuard`),
  `lazy: () => import('@org/pages-landing')`.
- Existing `errorElement: <RouteError />` and `*` NotFound behaviour unchanged.

Why not a separate Vite app (approach B) or inline components in
`apps/client/messenger/src` (approach C): B duplicates proxy/Tailwind/Nx setup
for 4 static sections; C violates `pages -> layouts -> ...` boundaries and the
public-entry-point rule (`import '@org/pages-landing'`, never `src/...`).

## 3. Components

All visual primitives from `@org/shared` root entry point:

- `Heading` (`libs/client/shared/src/ui/typography/heading.tsx`): `h1` level 1 in
  hero, `h2` level 2 per stack block. Uses existing responsive sizes.
- `Text` (`libs/client/shared/src/ui/typography/text.tsx`): `p` body copy,
  `color="muted"` for secondary lines.
- `Button` (`libs/client/shared/src/ui/button/button.tsx`): CTA only.
  Primary "Open messenger" (`to="/chats"`), secondary "Sign in" (`to="/auth/login"`).
  Use `react-router` `Link` wrapping or Button `asChild`-style navigation consistent
  with `NotFoundPage` pattern; no new CSS variants.
- `Logo` (`libs/client/shared/src/ui/logo/logo.tsx`): header brand mark.

Sections (mobile-first Tailwind, layout/geometry classes locally, colours and type
only via tokens/primitives per `docs/DEVELOPMENT.md`):

1. `LandingHeader` — `header > nav` with skip-link, logo, anchor links
   `#hero`/`#stack`, CTA button. Base `flex-col`, `sm:flex-row`.
2. `LandingHero` — `section id="hero" aria-labelledby`, `h1` e.g. "Fast, private
   messenger for teams", sub-copy `Text`, two CTAs, small realtime/status line.
   Copy is English, drafted at implementation time (no external copy provided).
3. `LandingStack` — `section id="stack"` with two `h2` blocks:
   - Capabilities: chats, realtime Socket.IO, media via gateway, user search,
     notifications (matches implemented ARCHITECTURE surfaces only).
   - Technologies: React + Vite SPA, NestJS API Gateway, PostgreSQL per service,
     Redis sessions, RabbitMQ events, MinIO media, Meilisearch user search.
   - Markup: `ul > li` with `Text as="li"` or `li > Text`, no fake headings.
4. `LandingFooter` — `footer` (+ `contentinfo`), minimal nav + copyright, no
   external links (keeps noindex surface clean).

Tailwind v4 note (`docs/MONOREPO_GOTCHAS.md`): `libs/client/**` is already in
`@source`, so no `global.css` change is needed.

## 4. Data flow

Fully static. No API calls, no TanStack Query, no Zustand, no Socket.IO, no
`frontendLog` noise (production console must stay clean). Navigation only via
router links.

## 5. Error handling

No domain errors. Invalid sub-paths fall through to existing `*` NotFound route.
Lazy-load failure surfaces via existing `RouteError`.

## 6. Anti-indexing

- `apps/client/messenger/public/robots.txt` (copied verbatim to `dist/` by Vite):
  ```text
  User-agent: *
  Disallow: /
  ```
  This blocks the whole messenger host, which is exactly what was requested
  ("forbid indexing of this site at all").
- Landing page head: `<meta name="robots" content="noindex, nofollow, noarchive" />`
  applied while the route is mounted and restored on unmount (no global layout change).
- No sitemap file, no `<link rel="canonical">` promotion, no external backlinks added.

## 7. Testing

- `landing-page.spec.tsx`: renders `h1`, `nav`, `main`, `footer`; CTA links point
  to `/chats` and `/auth/login`; robots meta asserted while mounted.
- Manual: 360px viewport check, keyboard tab order, single-`h1` check.
- Verification: `npm exec nx lint @org/pages-landing`, `test`, `typecheck`,
  `build`, plus messenger `lint` (boundaries) and `build`.

## 8. Non-goals (YAGNI)

No i18n, no separate dark theme, no animations, no forms/analytics, no PWA or
service-worker changes, no backend/RabbitMQ/DB changes.
