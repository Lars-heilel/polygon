# TODO

## OAuth — убрать заглушки и настроить credentials

Сейчас в стратегиях стоят заглушки `'not-configured'` вместо реальных ключей.
Пока OAuth не работает — кнопки входа через GitHub/Google/Yandex будут падать с ошибкой.

Что сделать:

1. Зарегистрировать OAuth-приложения в нужных сервисах
2. Заполнить в `.env`:

   ```
   GITHUB_CLIENT_ID=
   GITHUB_CLIENT_SECRET=

   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=

   YANDEX_CLIENT_ID=
   YANDEX_CLIENT_SECRET=
   ```

3. Убрать fallback `|| 'not-configured'` в стратегиях:
   - `libs/backend/auth/src/strategies/github.strategy.ts`
   - `libs/backend/auth/src/strategies/google.strategy.ts`
   - `libs/backend/auth/src/strategies/yandex.strategy.ts`

---

## Тестирование системы авторизации

### Статус

| Слой | Фреймворк | Статус |
|------|-----------|--------|
| Backend unit (auth-service) | Jest + SWC | ❌ не реализовано |
| Backend integration (gateway) | Jest + Supertest | 🟡 частично (register, logout, forgot/reset-password) |
| Frontend unit (hooks, store) | Vitest + MSW | ❌ не реализовано |
| Frontend component | Vitest + Testing Library | ❌ не реализовано |
| E2E | Playwright | ❌ не реализовано |

---

### 1. Backend — Unit-тесты `auth-service` (Jest)

Файл: `libs/backend/auth/src/services/auth.service.spec.ts`

- [ ] `register` — успешная регистрация, дублирующий email (ConflictException)
- [ ] `login` — успешный вход, неверный пароль (UnauthorizedException), несуществующий пользователь
- [ ] `logout` — удаление refresh-токена из БД
- [ ] `refresh` — валидный токен → новая пара, просроченный/отсутствующий токен (UnauthorizedException)
- [ ] `forgotPassword` — отправка письма, несуществующий email (не выбрасывает ошибку — security)
- [ ] `resetPassword` — валидный токен, просроченный токен, уже использованный токен
- [ ] `verifyEmail` — успешная верификация, невалидный токен

Подход: мокать `AuthPrismaRepository` и `JwtService` через jest.fn() / `jest.spyOn`.

---

### 2. Backend — Integration-тесты Gateway (Jest + Supertest)

Файл: `apps/backend/gateway/src/controllers/auth.controller.spec.ts` (уже существует)

Дополнить существующие тесты:

- [ ] `POST /api/auth/login` — успех (200 + Set-Cookie), неверные данные (401), невалидное тело (400)
- [ ] `POST /api/auth/refresh` — успех (новые cookies), без cookie (401)
- [ ] `GET /api/auth/me` — авторизован (200 + user), без токена (401)
- [ ] OAuth редиректы — `GET /api/auth/github`, `/google`, `/yandex` → 302

Инфраструктура (`apps/backend/gateway/src/test/create-test-app.ts`) уже готова — мокает ClientProxy, не нужен RabbitMQ.

---

### 3. Frontend — Unit-тесты hooks и store (Vitest + MSW)

#### 3a. API-хуки (`libs/client/entities/src/lib/user/user.api.ts`)

Файл: `libs/client/entities/src/lib/user/user.api.spec.ts`

MSW-сервер уже настроен (`libs/client/entities/src/test/server.ts`).

- [ ] `useLoginMutation` — успех (обновляет session store), ошибка 401
- [ ] `useRegisterMutation` — успех (201), конфликт 409
- [ ] `useLogoutMutation` — успех (сбрасывает store)
- [ ] `useMeQuery` — возвращает пользователя, 401 → не кидает в store
- [ ] `useForgotPasswordMutation` / `useResetPasswordMutation` — успех, ошибка

Обёртка: `renderHook` + `QueryClientProvider` + `wrapper`.

#### 3b. Session store (`libs/client/entities/src/lib/session/session.store.ts`)

Файл: `libs/client/entities/src/lib/session/session.store.spec.ts`

- [ ] Начальное состояние: `isAuthenticated=false`, `isLoading=true`
- [ ] Установка пользователя → `isAuthenticated=true`
- [ ] `logout()` → сброс в initial state
- [ ] Селекторы `selectIsAuthenticated`, `selectIsSessionLoading`

#### 3c. `authed-fetch` (`libs/client/entities/src/lib/api/authed-fetch.ts`)

- [ ] Успешный запрос → возвращает данные
- [ ] 401 → автоматически вызывает refresh, повторяет запрос
- [ ] Refresh тоже 401 → выбрасывает ошибку / разлогинивает

---

### 4. Frontend — Component-тесты (Vitest + Testing Library)

#### 4a. OAuth-кнопки (`libs/client/features/src/lib/auth/ui/oauth-buttons.tsx`)

Файл: `libs/client/features/src/lib/auth/ui/oauth-buttons.spec.tsx`

- [ ] Рендерится 3 кнопки (GitHub, Google, Yandex)
- [ ] Клик по кнопке → редирект на нужный OAuth-URL

#### 4b. Формы (когда будут добавлены LoginForm / RegisterForm)

- [ ] Валидация полей (пустые, невалидный email, пароль короче минимума)
- [ ] Успешный сабмит → вызов мутации
- [ ] Отображение серверных ошибок (409 Conflict, 401)
- [ ] Состояние загрузки (кнопка задизейблена)

---

### 5. E2E — Playwright

Установка:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Конфиг: `playwright.config.ts` в корне — `baseURL: http://localhost:4200`, хранение `storageState` для авторизованных тестов.

#### 5a. Сценарии

- [ ] Регистрация нового пользователя → редирект в чат
- [ ] Вход с верными данными → редирект в чат, session сохраняется
- [ ] Вход с неверным паролем → сообщение об ошибке
- [ ] Обновление страницы — сессия восстанавливается (refresh-токен из cookie)
- [ ] Выход → редирект на логин, защищённые роуты недоступны
- [ ] Доступ к `/` без авторизации → редирект на `/login`
- [ ] Forgot password — форма отправляет email, показывает подтверждение

#### 5b. Инфраструктура

- [ ] `tests/e2e/fixtures/auth.fixture.ts` — `test.extend` с готовой авторизованной страницей (`storageState`)
- [ ] `tests/e2e/pages/login.page.ts` — Page Object для страницы входа
- [ ] `tests/e2e/pages/register.page.ts` — Page Object для регистрации
- [ ] Добавить в CI шаг `playwright test` после запуска приложения

---

### Порядок реализации

1. **Backend unit** (`auth.service.spec.ts`) — изолировано, без инфраструктуры
2. **Backend integration** — дополнить `auth.controller.spec.ts`
3. **Frontend store + authed-fetch** — чистая логика, без UI
4. **Frontend hooks** — нужен MSW (уже готов)
5. **Frontend components** — формы появятся позже
6. **E2E** — последними, требуют работающего стека
