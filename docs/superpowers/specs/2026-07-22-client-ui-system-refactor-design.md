# Client UI System Refactor Design

## Goal

Standardize the client visual system so new features and refactors use shared UI logic, shared typography, and semantic theme tokens by default. The UI must be readable in both light and dark themes and portable across messenger screens, feature modals, pages, and future client apps.

## Current Problems

`libs/client/shared/src/styles/global.css` currently mixes theme tokens with component behavior. It globally overrides selectors such as `button.bg-primary`, `.bg-green-500`, `.border-b.border-border`, `aside`, and `[role='dialog']`. This makes components hard to reason about because their rendered style depends on incidental class names rather than explicit component variants.

The semantic palette is incomplete for the classes already used by shared components. Components reference tokens such as `primary-hover`, `danger`, `success`, and `background`, but the stylesheet does not define a complete documented contract for them.

Many feature/page components manually style repeated UI patterns with Tailwind classes instead of consuming `@org/shared` primitives. This creates drift between screens and makes light/dark readability inconsistent.

## Direction

Use `@org/shared` as the single owner of reusable UI behavior:

- `Text` and `Heading` own content typography and semantic text color usage.
- `Button` and `IconButton` own action styling and disabled/loading states.
- `Input`, `Textarea`, `Toggle`, `Dropdown`, `Modal`, `Badge`, `Spinner`, `Skeleton`, `FormAlert`, `EmptyState`, `StatusScreen`, `Toast`, `MediaViewer`, and future primitives own their visual variants.
- Feature/page code uses Tailwind mainly for layout and responsive composition.
- Semantic tokens in `global.css` define the visual language. Components consume those tokens instead of hardcoded purple/gray/white/black palettes.

## Global CSS Boundary

`global.css` should contain only:

- Tailwind v4 imports and `@source` paths;
- semantic color, radius, shadow, typography, motion, and focus tokens;
- light/dark theme overrides;
- document-level base styles;
- unavoidable third-party widget integration styles.

It should not contain broad component hacks that target generic class names. Existing hacks should be removed during the visual refactor and replaced with explicit shared component variants or local feature styles.

## Visual Refactor Principles

The redesigned palette should not be a one-note purple/blue theme. Purple may remain as an accent, but surfaces, text, borders, success, warning, danger, info, selection, focus, and muted states need independent semantic values with tested contrast in light and dark themes.

Typography must remain centralized through existing `Text` and `Heading`. If current typography variants are insufficient, extend those components rather than bypassing them with repeated local `text-*` classes.

Shared components should expose small explicit variant APIs. New variants are acceptable only when at least two callers need the behavior or when the behavior is part of the product-wide UI language.

## Documentation Rule

`docs/DEVELOPMENT.md` now documents the client UI system rule: new client code must use shared primitives and typography first, use local Tailwind mainly for layout, and keep `global.css` scoped to tokens/base/third-party integration.

## Implementation Scope For Next Plan

The next implementation plan should:

1. Define a complete semantic token set in `global.css`.
2. Remove broad global component overrides.
3. Update shared primitives to consume the new token contract.
4. Add or update focused shared component tests where behavior is affected.
5. Migrate the highest-impact messenger surfaces first: modal shell/viewer, chat header/footer controls, message bubbles, profile/media panels, and list/sidebar states.

Existing work-in-progress changes in the repository must be preserved and reviewed before editing overlapping files.
