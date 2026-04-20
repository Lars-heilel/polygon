# Compound Components: Modal + Dropdown

## Scope

Refactor `Modal` and `Dropdown` in `libs/client/shared` to compound component pattern. Add `createPortal` to Modal. Add `useDisclosure` hook.

## Architecture

Each component owns a React Context that shares state with its subcomponents. No new dependencies. `useDisclosure` is a standalone reusable hook.

## useDisclosure

New file: `libs/client/shared/src/lib/hooks/use-disclosure.ts`

```ts
useDisclosure(initialOpen?: boolean): {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}
```

Exported from `@org/shared` index.

## Modal

File: `libs/client/shared/src/ui/modal/modal.tsx`

### Context

```ts
interface ModalContextValue {
  onClose: () => void
}
```

Provided by `<Modal>`, consumed by subcomponents.

### Root (`<Modal>`)

Props: `isOpen`, `onClose`, `className?`, `overlayClassName?`, `children`

Behaviour:
- Renders via `createPortal` into `document.body`
- Returns `null` when `!isOpen`
- Locks `document.body` scroll when open
- Closes on Escape key
- Closes on overlay click

### Subcomponents

**`Modal.Header`**

Props: `title?`, `onClose?`, `children?`, `className?`

- If `title` is provided → renders `<Heading level={5}>` on the left and an `×` icon button on the right
- If `title` is omitted → renders `children` as-is (for custom headers like gradient banners)
- `onClose` falls back to context `onClose` if not passed explicitly

**`Modal.Body`**

Props: `children`, `className?`

Scrollable content area. `overflow-y-auto` by default.

**`Modal.Footer`**

Props: `children`, `className?`

Bottom action area with top border.

### Usage

```tsx
// Standard
<Modal isOpen={isOpen} onClose={close}>
  <Modal.Header title="Settings" />
  <Modal.Body>...</Modal.Body>
  <Modal.Footer>
    <Button onClick={close}>Cancel</Button>
  </Modal.Footer>
</Modal>

// Custom header (ProfileModal gradient)
<Modal isOpen={isOpen} onClose={close}>
  <Modal.Header>
    <div className="relative h-32 bg-gradient-to-r from-primary to-primary/60">
      ...
    </div>
  </Modal.Header>
  <Modal.Body>...</Modal.Body>
</Modal>
```

## Dropdown

File: `libs/client/shared/src/ui/dropdown/dropdown.tsx`

### Context

```ts
interface DropdownContextValue {
  isOpen: boolean
  close: () => void
}
```

### Root (`<Dropdown>`)

Props: `isOpen`, `onOpenChange`, `children`, `className?`

Behaviour:
- Controlled — caller manages state via `useDisclosure`
- Closes on outside click (via `useEffect` + `mousedown`)
- Provides context to subcomponents

### Subcomponents

**`Dropdown.Trigger`**

Props: `children`

Wraps children and toggles `onOpenChange` on click.

**`Dropdown.Menu`**

Props: `children`, `align?: 'left' | 'right'`, `className?`

Absolutely positioned menu panel. Renders only when `isOpen` is true.

**`Dropdown.Item`**

Props: `children`, `icon?`, `danger?`, `disabled?`, `onClick?`

Styled button. Calls `close()` from context after `onClick`.

**`Dropdown.Divider`**

No props. Renders `<Divider />`.

### Usage

```tsx
const dd = useDisclosure()

<Dropdown isOpen={dd.isOpen} onOpenChange={dd.toggle}>
  <Dropdown.Trigger>
    <IconButton icon={<MoreIcon />} />
  </Dropdown.Trigger>

  <Dropdown.Menu align="right">
    <Dropdown.Item icon={<EditIcon />} onClick={handleEdit}>Edit</Dropdown.Item>
    <Dropdown.Divider />
    <Dropdown.Item danger onClick={handleDelete}>Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
```

## Migration

Existing modal usages (`CreateChatModal`, `SettingsModal`, `ProfileModal`) must be updated to use the new subcomponents after refactor.

Existing `Dropdown` `items` prop API is removed — callers use subcomponents directly.

## Out of Scope

- Focus trap inside Modal
- Dropdown keyboard navigation
- Animation/transitions
