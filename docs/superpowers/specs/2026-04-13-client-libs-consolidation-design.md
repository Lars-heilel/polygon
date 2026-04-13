# Client Libs Consolidation — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Problem

`libs/client` содержит 6 Nx-библиотек с дублированием кода и нарушением принципов FSD:

- `widgets` и `pages/messenger/ui/` содержат идентичные компоненты (артефакт AI-разработки)
- `features/chat/` содержит messenger-специфичные хуки, которые не могут переиспользоваться
- `shared/ui/layouts/` содержит дубликат `auth-layout` из `layouts` lib
- Внутри слайсов отсутствует стандартная FSD-структура (`model/`, `ui/`, `index.ts`)

## Целевая архитектура

6 библиотек остаются, меняется только содержимое:

```
libs/client/
  shared/      — дизайн-система + инфраструктура (все apps)
  entities/    — бизнес-данные (все apps)
  features/    — переиспользуемые сценарии (≥2 apps)
  layouts/     — FSD-слой лейаутов (все apps)
  widgets/     — контейнер для будущих переиспользуемых виджетов (пустой после рефакторинга)
  pages/       — сборочная точка messenger (messenger-specific)
```

## Изменения по библиотекам

### `pages` — расширяется

Внутренняя структура мессенджер-слайса приводится к FSD-стандарту:

```
pages/messenger/
  model/
    chat-socket/
      socket-middleware.ts
      use-chat-socket.ts
    use-chat-list.ts
    use-chat-window.ts
    use-create-chat.ts
    use-send-message.ts
  ui/
    chat-header/
    chat-item/
    chat-list/
    chat-list-sidebar/
    chat-search/
    chat-window/
    create-chat-modal/
    message-input/
    message-list/
    profile-modal/
    settings-modal/
    sidebar-header/
    user-panel/
    chat-page.tsx
    messenger-main-page.tsx
    chats-layout.tsx
  index.ts
pages/auth/
  ui/
    (существующие страницы)
  index.ts
```

**Источник `model/`:** перенос из `features/chat/` (chat-socket, use-chat-list, use-chat-window, use-create-chat, send-message).

**Источник `ui/`:** для каждого дублирующегося компонента — сравнить `widgets/X` и `pages/messenger/ui/X`, оставить актуальную версию, дубликат удалить.

### `features` — очищается от messenger-специфичного кода

**Удаляется из `features`:**
- `chat/chat-socket/`
- `chat/send-message/`
- `chat/use-chat-list/`
- `chat/use-chat-window/`
- `chat/use-create-chat/`

**Остаётся в `features`:**
- `auth/` (model + ui) — переиспользуется в admin и других apps
- `theme/` (model + ui) — переиспользуется во всех apps
- `search/use-search-users.ts` — переиспользуется в admin (бан/роль юзера)

### `widgets` — очищается

Все текущие messenger-специфичные компоненты удаляются (они переходят в `pages/messenger/ui/`). Библиотека остаётся как пустой контейнер для будущих переиспользуемых виджетов между apps.

### `layouts` — без изменений по структуре

Дубликат `auth-layout.tsx` из `shared/src/ui/layouts/` удаляется. `layouts` lib остаётся единственным источником правды для лейаутов.

### `shared` — удаляется дубликат

`shared/src/ui/layouts/auth-layout.tsx` и `shared/src/ui/layouts/index.ts` — удаляются. Импорты обновляются на `@org/layouts`.

### `entities` — без изменений

`session.store`, `chat.store`, `user.api`, `search.api`, `chat.api` — переиспользуются во всех apps.

## Правила переиспользования по apps

| Lib | messenger | admin | dashboard | другие |
|-----|-----------|-------|-----------|--------|
| `shared` | ✓ | ✓ | ✓ | ✓ |
| `entities` | ✓ | ✓ | ✓ | ✓ |
| `layouts` | ✓ | ✓ | ✓ | ✓ |
| `features` | ✓ | ✓ (auth, theme, search) | ✓ (theme) | — |
| `widgets` | будущее | будущее | будущее | — |
| `pages` | ✓ | — | — | — |

## FSD-структура внутри слайса (стандарт)

Все слайсы после рефакторинга следуют структуре:

```
<slice>/
  model/    — хуки, стейт, бизнес-логика
  ui/       — React-компоненты
  api/      — запросы к API (если есть)
  lib/      — утилиты слайса (если есть)
  index.ts  — публичное API (только явные именованные экспорты)
```

`index.ts` экспортирует только то, что предназначено для внешнего использования. Внутренняя структура не вытекает наружу.

## Порядок выполнения

1. Сравнить и выбрать актуальные версии дублированных компонентов (widgets vs pages/ui)
2. Создать `pages/messenger/model/` и перенести хуки из `features/chat/`
3. Переместить актуальные компоненты в `pages/messenger/ui/`, удалить дубликаты
4. Очистить `widgets` lib от messenger-компонентов
5. Удалить `shared/ui/layouts/`, обновить импорты на `@org/layouts`
6. Обновить все импорты затронутых модулей
7. Запустить `npx nx run-many -t typecheck lint build` — убедиться что ничего не сломано
