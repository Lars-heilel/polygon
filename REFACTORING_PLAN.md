# Refactoring Plan: Bundle Splitting (Variant 3)

## Цель

Максимальный code-splitting: каждая страница — отдельный чанк + тяжёлые фичи выделены в отдельные пакеты + vendor chunks через `manualChunks`. Initial load ~200 KB, всё остальное догружается по мере необходимости.

---

## 1. Текущее состояние (проблемы)

### 1.1 Один жирный lazy-чанк (430 KB)

Все 9 роутов делают `lazy: () => import('@org/pages')` — Rollup создаёт один чанк, в котором:

| Что внутри | Размер |
|---|---|
| react-hook-form + @hookform/resolvers + zod | ~90 KB |
| react-virtuoso | ~86 KB |
| markdown-стек (react-markdown, unified, micromark*, remark-gfm) | ~150 KB |
| react-syntax-highlighter + 25 языков | ~50 KB |
| Все page-компоненты | ~40 KB |
| @org/features (всё кроме markdown) | ~50 KB |
| **Итого** | **~430 KB** |

### 1.2 Heavy libraries в entry chunk (505 KB)

| Библиотека | Размер | Проблема |
|---|---|---|
| React + ReactDOM | ~780 KB | Норма |
| zod | ~150 KB | ❌ Только для форм, не нужен на старте |
| socket.io-client + engine.io-client | ~90 KB | ❌ Только для чата |
| sonner | ~63 KB | Нужен везде |
| tailwind-merge + clsx | ~100 KB | Утилиты |
| zustand | ~8 KB | Норма |
| @tanstack/query-core | ~75 KB | Нужен везде |
| **Итого entry** | **~505 KB** | |

### 1.3 Barrel-экспорты в @org/pages

```ts
// pages/src/index.ts
export * from './lib/auth';      // 6 страниц
export * from './lib/messenger';  // 3 страницы
```

Из-за этого `import('@org/pages')` загружает всё.

### 1.4 Дублирование markdown-message

Код markdown-message есть и в `@org/features` (старый, мёртвый) и в `@org/features-markdown` (новый, активный). Нужно удалить старую копию.

### 1.5 socket.io-client грузится на старте

Инициализация сокета происходит в `main.tsx` → `socket-middleware.ts`, который импортирует `@org/shared`, который в `index.ts` экспортирует socket. В результате socket.io-client попадает в entry chunk.

---

## 2. Целевая архитектура

### 2.1 Итоговая архитектура

```
libs/client/
  pagesNew/                         ← временно, после рефакторинга → pages/
    auth/
      pages-login/                  → @org/pages-login
      pages-register/               → @org/pages-register
      pages-forgot-password/        → @org/pages-forgot-password
      pages-reset-password/         → @org/pages-reset-password
      pages-check-email/            → @org/pages-check-email
      pages-email-verified/         → @org/pages-email-verified
    messenger/
      pages-chats-layout/           → @org/pages-chats-layout
      pages-messenger-main/         → @org/pages-messenger-main
      pages-chat-page/              → @org/pages-chat-page
    system/
      pages-not-found/              → @org/pages-not-found
      pages-design-system/          → @org/pages-design-system (dev only)

  featuresNew/                      ← временно, после → features/
    markdown-message/               → @org/features-markdown ✅ уже есть

  features/                         → будет удалён
  pages/                            → будет удалён
  entities/
  shared/
  widgets/
  layouts/
```

### 2.2 Существующие пакеты (без изменений или с изменениями)

| Пакет | Описание |
|---|---|
| `@org/features` | Остаётся, удалить MarkdownMessage из index.ts |
| `@org/features-markdown` | Уже создан ✅ |
| `@org/entities` | Без изменений |
| `@org/shared` | Без изменений |
| `@org/widgets` | Без изменений |
| `@org/layouts` | Без изменений |
| `@org/common` | Без изменений |

### 2.3 Структура роутов после рефакторинга

```ts
// auth.routes.tsx
{ path: 'login',          lazy: () => import('@org/pages-login').then(m => ({ Component: m.LoginPage })) }
{ path: 'register',       lazy: () => import('@org/pages-register').then(m => ({ Component: m.RegisterPage })) }
{ path: 'forgot-password', lazy: () => import('@org/pages-forgot-password').then(m => ({ Component: m.ForgotPasswordPage })) }
{ path: 'reset-password', lazy: () => import('@org/pages-reset-password').then(m => ({ Component: m.ResetPasswordPage })) }
{ path: 'check-email',    lazy: () => import('@org/pages-check-email').then(m => ({ Component: m.CheckEmailPage })) }
{ path: 'email-verified', lazy: () => import('@org/pages-email-verified').then(m => ({ Component: m.EmailVerifiedPage })) }

// app.routes.tsx
{ path: '/chats',          lazy: () => import('@org/pages-chats-layout').then(m => ({ Component: m.ChatsLayout })), children: [
  { index: true,           lazy: () => import('@org/pages-messenger-main').then(m => ({ Component: m.MessengerMainPage })) }
  { path: ':chatId',       lazy: () => import('@org/pages-chat-page').then(m => ({ Component: m.ChatPage })) }
]}

// router.tsx
{ path: '*', lazy: () => import('@org/pages-not-found').then(m => ({ Component: m.NotFoundPage })) }
// dev:
{ path: '/ds', lazy: async () => {
    const [{ DesignSystemPage }, { ThemeToggle }] = await Promise.all([
      import('@org/pages-design-system'),
      import('@org/features'),
    ]);
    return { element: <DesignSystemPage headerSlot={<ThemeToggle />} /> };
  }
}
```

### 2.4 manualChunks в vite.config.mts

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('react-virtuoso')) return 'chunk-virtuoso'
        if (id.includes('react-hook-form') || id.includes('@hookform/resolvers')) return 'chunk-auth-vendor'
        if (id.includes('features-markdown') || id.includes('react-markdown') || id.includes('react-syntax-highlighter')) return 'chunk-markdown'
        if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'chunk-socket'
      }
    }
  }
}
```

### 2.5 Дополнительный код-сплиттинг внутри страниц

В `VirtualMessageList.tsx` (внутри `@org/pages-chat-page`) сделать динамический импорт `MarkdownMessage`:

```ts
const MarkdownMessage = lazy(() => import('@org/features-markdown').then(m => ({ default: m.MarkdownMessage })));
```

Тогда markdown-стек грузится только когда есть сообщение с разметкой, а не при входе в чат.

---

## 3. Ожидаемые чанки после рефакторинга

| Чанк | Размер | Когда загружается |
|---|---|---|
| **entry (main)** | **~200 KB** | Всегда (React, core, app-shell, zustand, query-core) |
| **chunk-auth-vendor** | **~90 KB** | Первая auth-страница (react-hook-form + zod) |
| **page-login** | **~2 KB** | /auth/login |
| **page-register** | **~2 KB** | /auth/register |
| **page-forgot-password** | **~2 KB** | /auth/forgot-password |
| **page-reset-password** | **~2 KB** | /auth/reset-password |
| **page-check-email** | **~1 KB** | /auth/check-email |
| **page-email-verified** | **~1 KB** | /auth/email-verified |
| **page-chats-layout** | **~20 KB** | /chats (layout + sidebar) |
| **page-messenger-main** | **~1 KB** | /chats (index) |
| **page-chat-page** | **~100 KB** | /chats/:chatId |
| **chunk-virtuoso** | **~86 KB** | Первый вход в чат (react-virtuoso) |
| **chunk-markdown** | **~250 KB** | Первое сообщение с разметкой |
| **chunk-socket** | **~90 KB** | Первый вход в чат (socket.io) |
| **page-not-found** | **~1 KB** | 404 |
| **emoji-mart** | **~76 KB** | Первый клик на emoji (уже работает) |

---

## 4. План реализации (порядок шагов)

### Фаза 1: Подготовка (удаление дубликатов)

- [ ] Удалить `libs/client/features/src/lib/chat/markdown-message/` (копия в `@org/features-markdown` уже есть и активна)
- [ ] Удалить `libs/client/features/src/lib/chat/markdown-message` из `@org/features/src/index.ts` (уже сделано)
- [ ] Убедиться что `@org/features` собирается без MarkdownMessage

### Фаза 2: Создание пакетов для страниц (11 шт)

Каждый пакет = non-buildable библиотека (только package.json + tsconfig + src/index.ts + код страницы).

Шаблон создания:
```bash
# Создать директорию
mkdir -p libs/client/pagesAuth/pages-login/src/lib

# package.json
cat > libs/client/pagesAuth/pages-login/package.json <<JSON
{
  "name": "@org/pages-login",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "@org/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "nx": { "tags": ["layer:pages", "scope:client"] },
  "sideEffects": false
}
JSON
```

Пакеты (структура: `libs/client/pagesNew/{group}/{package}/`):

1. **`libs/client/pagesNew/auth/pages-login/`** → `@org/pages-login`
   - `src/index.ts` → `export { LoginPage } from './lib/login-page'`
   - `src/lib/login-page.tsx` → копия из `@org/pages/src/lib/auth/login-page.tsx`

2. **`libs/client/pagesNew/auth/pages-register/`** → `@org/pages-register`

3. **`libs/client/pagesNew/auth/pages-forgot-password/`** → `@org/pages-forgot-password`

4. **`libs/client/pagesNew/auth/pages-reset-password/`** → `@org/pages-reset-password`

5. **`libs/client/pagesNew/auth/pages-check-email/`** → `@org/pages-check-email`

6. **`libs/client/pagesNew/auth/pages-email-verified/`** → `@org/pages-email-verified`

7. **`libs/client/pagesNew/messenger/pages-chats-layout/`** → `@org/pages-chats-layout`
   - Самая объёмная страница (ChatsLayout + Sidebar + модалки)

8. **`libs/client/pagesNew/messenger/pages-messenger-main/`** → `@org/pages-messenger-main`

9. **`libs/client/pagesNew/messenger/pages-chat-page/`** → `@org/pages-chat-page`
   - ChatPage + ChatWindow + ChatMain + ChatFooter + VirtualMessageList
   - Здесь же динамический импорт MarkdownMessage

10. **`libs/client/pagesNew/system/pages-not-found/`** → `@org/pages-not-found`

11. **`libs/client/pagesNew/system/pages-design-system/`** → `@org/pages-design-system`

### Фаза 3: Обновление роутов

- [ ] Заменить все `import('@org/pages')` на конкретные пакеты в:
  - `apps/client/messenger/src/app/router/app.routes.tsx`
  - `apps/client/messenger/src/app/router/auth.routes.tsx`
  - `apps/client/messenger/src/app/router/router.tsx`

### Фаза 4: Удаление старого @org/pages

- [ ] Удалить директорию `libs/client/pages/` (весь код перенесён)
- [ ] Удалить проект из npm workspaces (убрать `libs/client/pages` — оно входит в `libs/client/*` — но раз папки нет, npm сам его не найдёт)

### Фаза 5: manualChunks + lazy внутри страниц

- [ ] Добавить `manualChunks` в `apps/client/messenger/vite.config.mts`
- [ ] Сделать `MarkdownMessage` ленивым внутри `VirtualMessageList` (chat-page пакет)
- [ ] Сделать `socket.io-client` ленивым (инициализация при входе в чат, а не в main.tsx)

### Фаза 6: Проверка

- [ ] `nx build messenger` — сборка без ошибок
- [ ] `nx build @org/features-markdown` — собирается
- [ ] Проверить `stats.html` — чанки соответствуют ожиданиям
- [ ] `nx lint messenger` — без ошибок
- [ ] `nx typecheck messenger` — без ошибок

---

## 5. Примечания

- Все зависимости (react-markdown, react-syntax-highlighter etc.) остаются в корневом `package.json`. Новые пакеты НЕ имеют своих dependencies.
- npm workspaces подхватывает новые пакеты через `"libs/client/*"` — нужно добавить `"libs/client/pagesNew/*"`, `"libs/client/pagesNew/auth/*"`, `"libs/client/pagesNew/messenger/*"`, `"libs/client/pagesNew/system/*"` в корневой `package.json`.
- Все пакеты non-buildable (без vite.config.mts) — не нужно их собирать в dist, Vite берёт исходники через `@org/source` condition.
- Nx module boundaries: все новые пакеты получают `"layer:pages"`, `"scope:client"`.
