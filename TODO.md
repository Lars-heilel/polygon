# TODO — MVP Roadmap

> Статус: **планирование / согласование**

---

## Статус сервисов

| Сервис       | Бэкенд      | Фронт     | Готовность                |
| ------------ | ----------- | --------- | ------------------------- |
| Auth         | ✅ полный   | ✅ полный | Баги + доработки + тесты  |
| Chat         | ✅ полный   | ✅ полный | Advanced features + тесты |
| User         | ✅ полный   | ✅ полный | Тесты                     |
| Notification | ✅ email    | —         | Норм для MVP              |
| Media        | ❌ заглушка | —         | **Вне MVP**               |

---

## БЛОК 1: AUTH — Регистрация и верификация email

### Требования

- Email+password регистрация → обязательное подтверждение email, без него доступ запрещён
- Пользователь может запросить повторную отправку письма
- OAuth (GitHub / Google / Yandex) → пароль не нужен, аккаунт авто-верифицирован

### Поток email-регистрации (текущий)

```
RegisterForm { email, password, username }
  → POST /api/auth/register
  → AuthService.register()
    → findByEmail → 409 если занят
    → createCredentials (isVerified: false)
    → emit USER_EVENTS.REGISTERED → UserService (fire-and-forget)
    → Redis: verification token (24h TTL)
    → emit NOTIFICATION_EVENTS.SEND_VERIFICATION_EMAIL (fire-and-forget)
    → issueTokenPair → set cookies
  → setAuthenticated(true) → navigate /chats   ← ПРОБЛЕМА: пускаем без верификации
```

### Найденные баги и доработки

#### БАГ-1: MSW handler — неверное поле

- `libs/client/entities/src/test/handlers/auth.handlers.ts:23`
- `username: 'testuser'` → должно быть `name: 'testuser'`, добавить `displayName: null`

#### БАГ-2: `useRegister` — глухой catch

- `libs/client/features/src/lib/auth/model/use-register.ts`
- Любая ошибка (409, 400, 500) → одно сообщение "Registration failed"
- Нужно: `ApiError(409)` → "Email already in use", остальное → generic

#### ДОРАБОТКА-1: Email verification enforcement

- После register → пользователь попадает в `isAuthenticated=true` без верификации
- Решение: после register **не** делать `setAuthenticated(true)`, вместо этого показывать страницу "Check your email"
- `ProtectedRoute` остаётся без изменений — пользователь просто не попадает в `/chats` до верификации
- Страница "Check your email": кнопка "Resend verification email"

#### ДОРАБОТКА-2: `GET /api/auth/verify-email` — нет токенов и редиректа

- Сейчас: проверяет токен → возвращает `{ message }`
- Нужно: verify → get credentials → issueTokenPair → set cookies → redirect `CLIENT_URL`
- Нужно расширить `VerificationService.verify()` чтобы возвращал `credentialsId`
- Нужно расширить gateway endpoint чтобы выдавал токены и редиректил

#### ДОРАБОТКА-3: Resilience — надёжная доставка событий

- Полноценная Saga не нужна: если пользователь не подтвердил email → credentials мусор, профиль не нужен
- Гарантия нужна только в момент когда пользователь кликает по ссылке верификации — к тому моменту UserService уже давно должен был обработать событие

**Решение:**

1. **RabbitMQ manual ack** — проверить что `noAck: false` в UserService consumer, тогда если сервис упал до обработки → сообщение вернётся в очередь и будет повторно доставлено при восстановлении

2. **Idempotent createFromEvent** — `UserService.createFromEvent` использует `upsert` вместо `create`, безопасно при повторной доставке

3. **Cleanup job** — удалять `Credentials` с `isVerified: false` старше 24 часов (тот же TTL что у verification token в Redis). Cron в auth-service.

```
[ ] Проверить noAck конфигурацию в user-service main.ts
[ ] UserService.createFromEvent → prisma.user.upsert
[ ] Добавить cron задачу в auth-service: удалять unverified credentials > 24h
[ ] Тест: повторная доставка USER_EVENTS.REGISTERED → upsert не падает
```

#### Поведение после верификации — решено ✅

- Всегда выдавать свежую пару токенов при verify, независимо от браузера
- verify token → get credentials → issueTokenPair → set cookies → redirect CLIENT_URL

### Тесты

#### Backend unit — `libs/backend/auth/src/services/auth.service.spec.ts`

```
[ ] register: успешная регистрация → TokenPair
[ ] register: дублирующий email → ConflictException
[ ] register: userClient.emit вызван с USER_EVENTS.REGISTERED
[ ] register: verification.generateAndSend вызван
[ ] verifyEmail: валидный токен → верификация
[ ] verifyEmail: невалидный/просроченный токен → BadRequestException
[ ] resendVerification: успех
[ ] resendVerification: уже верифицирован → BadRequestException
```

#### Gateway integration — `auth.controller.spec.ts`

```
[ ] POST /api/auth/register: 201 + cookies (уже есть ✅)
[ ] POST /api/auth/register: 400 невалидный email (уже есть ✅)
[ ] POST /api/auth/register: 409 конфликт (уже есть ✅)
[ ] GET /api/auth/verify-email: 200 + cookies + redirect (новый после ДОРАБОТКИ-2)
[ ] GET /api/auth/verify-email: 400 невалидный токен
[ ] POST /api/auth/resend-verification: 201
```

#### Frontend unit

```
[ ] session.store.spec.ts — начальное состояние, setAuthenticated, селекторы
[ ] user.api.spec.ts — useRegisterMutation (201, 409), useMeQuery (200, 401)
```

---

## БЛОК 2: AUTH — Login

### Требования

- Email+password → только для верифицированных аккаунтов
- OAuth → всегда разрешён (аккаунт авто-верифицирован)
- Если email зарегистрирован через email+password, потом попытка войти через OAuth с тем же email → **merge аккаунтов** (уже реализовано в `oauthLogin`)

### Поток

```
LoginForm { email, password }
  → LocalGuard → LocalStrategy.validate() → validateCredentials()
    → findByEmail → если нет или нет passwordHash → 401
    → bcrypt.compare → если не совпадает → 401
    → вернуть { id, role, isVerified }
  → login(id) → issueTokenPair
  → set cookies → setAuthenticated(true)
```

### Доработки

#### ДОРАБОТКА-4: Login — проверка isVerified

- Сейчас `validateCredentials` не проверяет `isVerified`
- Вариант A: блокировать login (403) если не верифицирован
- Вариант B: пускать, но ограничивать доступ через guard
- **Решение**: Вариант A — проще и честнее. `UnauthorizedException` с сообщением "Please verify your email"
- При этом показывать на фронте ссылку на resend-verification

#### ДОРАБОТКА-5: OAuth + существующий email-аккаунт

- Текущее поведение: `oauthLogin` находит credentials по email, линкует OAuth account, авто-верифицирует ✅
- Корректно — OAuth провайдер подтверждает владение email
- Нужно: уведомить пользователя "Yandex OAuth добавлен к вашему аккаунту" (notification event)

#### ДОРАБОТКА-6: OAuth пользователь хочет добавить пароль

- Новый endpoint: `POST /api/auth/set-password` (только если `passwordHash = null`)
- Фронт: в настройках аккаунта — "Add password" форма
- Валидация: тот же `PASSWORD_REGEX`

### Тесты

```
[ ] auth.service.spec.ts — validateCredentials: успех, неверный пароль, не существует, нет passwordHash (OAuth юзер)
[ ] auth.service.spec.ts — login: успех, не найден → UnauthorizedException
[ ] gateway — POST /api/auth/login: 201 + cookies
[ ] gateway — POST /api/auth/login: 401 неверный пароль
[ ] gateway — POST /api/auth/login: 400 невалидное тело
[ ] frontend — useLoginMutation: успех, 401
```

---

## БЛОК 3: AUTH — Logout / Refresh / Password Reset

### Поток logout

```
POST /api/auth/logout (refresh_token cookie)
  → revokeRefreshToken(hash)
  → clearCookies
```

### Поток refresh

```
POST /api/auth/refresh (refresh_token cookie)
  → verifyRefreshToken (JWT signature)
  → findRefreshToken(hash) → проверить revokedAt, expiresAt
  → revokeRefreshToken (ротация)
  → issueTokenPair
  → set cookies
```

### Поток password reset

```
POST /api/auth/forgot-password { email }
  → findByEmail → если нет или нет passwordHash → тихо return (no enumeration)
  → generatePasswordReset → Redis (1h TTL) → emit NOTIFICATION_EVENTS.SEND_PASSWORD_RESET

POST /api/auth/reset-password { token, newPassword }
  → consumePasswordResetToken → credentialsId
  → updatePasswordHash
  → revokeAllRefreshTokens  ← все сессии отзываются ✅
  → [НУЖНО] clearCookies в gateway response  ← сейчас не делается
```

### Доработки

#### ДОРАБОТКА-7: `reset-password` gateway — не очищает cookies

- После успешного сброса пароля gateway не вызывает `clearTokenCookies`
- Пользователь остаётся с невалидными cookies до следующего запроса
- Фикс: добавить `clearTokenCookies(response)` в `resetPassword` handler

#### ДОРАБОТКА-8: UX reset-password

- После успешного сброса → показать "Password changed. Please sign in." → redirect `/auth/login`
- Уже реализовано в `useResetPassword` ✅

### Тесты

```
[ ] auth.service.spec.ts — logout: revokeRefreshToken вызван; без токена — не падает
[ ] auth.service.spec.ts — refresh: успех, просроченный, отозванный → 401
[ ] auth.service.spec.ts — forgotPassword: нет email → тихо return; есть email → generatePasswordReset
[ ] auth.service.spec.ts — resetPassword: успех → updatePasswordHash + revokeAll; плохой токен → 400
[ ] gateway — POST /api/auth/logout: 201 + clearCookies (уже есть ✅, исправить описание)
[ ] gateway — POST /api/auth/refresh: 201 + новые cookies
[ ] gateway — POST /api/auth/refresh: 401 без cookie
[ ] gateway — POST /api/auth/reset-password: clearCookies (после ДОРАБОТКИ-7)
[ ] frontend — authedFetch: 401 → refresh → retry → успех
[ ] frontend — authedFetch: 401 → refresh fails → setAuthenticated(false)
```

---

## БЛОК 4: AUTH — Rate Limiting (Brute Force + Email Spam)

### Всё через Redis — инфраструктура уже есть

#### Login brute force — `AuthService.validateCredentials`

```
login_attempts:{credentialsId}  →  INCR + TTL 15min
```

- 5 неудачных попыток → `TooManyRequestsException` (429) + `Retry-After` header
- Успешный вход → DEL ключа
- `lockedAt/lockedUntil` поля в Prisma схеме не используем — Redis чище
- Нужно добавить `incr(key, ttlSeconds): Promise<number>` в `RedisService`

#### Email resend cooldown — `VerificationService.resend`

```
email_verification_cooldown:{credentialsId}  TTL 120s
```

- Уже используем Redis для токенов, добавляем cooldown ключ
- Если ключ есть → `TooManyRequestsException`
- Ключ ставится ПОСЛЕ успешной генерации

#### Password reset cooldown — `VerificationService.generatePasswordReset`

```
password_reset_cooldown:{credentialsId}  TTL 300s
```

- Аналогично email resend

### Изменения в коде

```
[ ] RedisService: добавить метод incr(key, ttlSeconds): Promise<number>
[ ] AuthService.validateCredentials: login attempts counter
[ ] VerificationService.resend: cooldown check
[ ] VerificationService.generatePasswordReset: cooldown check
[ ] Gateway: добавить Retry-After header при 429
```

### Тесты

```
[ ] validateCredentials: 4 неудачных → не заблокирован
[ ] validateCredentials: 5-я неудачная → TooManyRequestsException
[ ] validateCredentials: успешный вход → счётчик сбрасывается
[ ] resend: повторный вызов в cooldown → TooManyRequestsException
[ ] resend: вызов после cooldown → успех
[ ] generatePasswordReset: повторный вызов в cooldown → TooManyRequestsException
```

---

## БЛОК 5: AUTH — OAuth

### Требования

- GitHub / Google / Yandex
- Нет пароля, авто-верификация
- Merge с существующим email-аккаунтом

### Доработки

#### ДОРАБОТКА-9: OAuth credentials в .env

- Убрать `|| 'not-configured'` в стратегиях после заполнения .env
- Добавить validation: если credentials не заданы → log warning при старте, не крашить

#### ДОРАБОТКА-10: OAuth → уведомление о merge

- Если OAuth привязан к существующему email-аккаунту → emit notification "OAuth provider linked"

### Тесты

```
[ ] GET /api/auth/github → 302 redirect
[ ] GET /api/auth/google → 302 redirect
[ ] GET /api/auth/yandex → 302 redirect
[ ] oauthLogin: новый пользователь → createCredentials + createOAuthAccount
[ ] oauthLogin: существующий email → link OAuth + auto-verify
[ ] oauthLogin: существующий OAuth account → просто issueTokenPair
```

---

## БЛОК 6: USER — Set Password (новая фича)

```
POST /api/auth/set-password { newPassword }  (JwtGuard)
  → findById → если passwordHash не null → 409 "Password already set"
  → hash(newPassword) → updatePasswordHash
```

```
[ ] Endpoint + DTO + auth.service метод
[ ] Фронт: Settings страница → "Add password" форма
[ ] Тест: успех, уже есть пароль → 409
```

---

## БЛОК 7: CHAT — Advanced Features

### Online status

```
Socket connect → Redis SET user:{id}:online TTL 30s
Socket disconnect → Redis DEL user:{id}:online
Heartbeat каждые 20s → обновлять TTL
GET /api/users/:id → включать поле isOnline из Redis
```

### Unread count

```
При message.created → INCR unread:{userId}:{chatId}
При chat:join / открытии чата → DEL unread:{userId}:{chatId}
GET /api/chats → включать unreadCount из Redis
```

### Typing indicators

```
socket.emit('typing:start', { chatId })
  → server broadcast 'typing:start' в room (кроме отправителя)
  → server: Redis SET typing:{chatId}:{userId} TTL 5s
socket.emit('typing:stop', { chatId })
  → server broadcast 'typing:stop'
Фронт: дебаунс 500ms на input
```

### Тесты

```
[ ] ChatService unit: все 5 методов
[ ] Gateway chat controller: 4 REST endpoint
[ ] useSendMessageMutation с MSW (optimistic update)
[ ] useChatSocket: join/leave/message:new
[ ] Убрать дублированный useChatSocket (оставить в libs/features)
```

---

## БЛОК 8: Frontend — UX и оптимизация

### Error UX — FormAlert компонент

**Правило:**

- Клиентская валидация → inline под полями (react-hook-form, уже работает ✅)
- API ошибки в формах → `FormAlert` компонент внутри формы над кнопкой Submit
- Фоновые операции (logout, send message, save settings) → toast остаётся ✅

**FormAlert** — новый компонент в `@org/shared`:

```tsx
<FormAlert variant="error | warning | info" action?: { label, onClick }>
  {message}
</FormAlert>
```

**Маппинг ошибок:**
| Ситуация | Компонент | Сообщение |
|---|---|---|
| 409 register | FormAlert error | "This email is already registered" |
| 401 login | FormAlert error | "Invalid email or password" |
| 401 + !isVerified | FormAlert warning + action | "Please verify your email · [Resend →]" |
| 429 rate limit | FormAlert warning | "Too many attempts. Try again in X min" |
| 400 validation | inline под полем | из react-hook-form |
| 500 server | FormAlert error | "Something went wrong. Please try again" |

**Существующие компоненты:**

- `StatusScreen` (`@org/shared`) — уже есть, нигде не используется. Variants: error | success | info.
  Использовать для: "Check your email" страница, "Email verified ✓" страница
- `FormAlert` — нужно создать (inline, внутри формы)

```
[ ] Создать FormAlert компонент в libs/client/shared (inline alert для форм)
[ ] Story для FormAlert (error / warning / info / с action кнопкой)
[ ] Story для StatusScreen (все 3 варианта, с children-кнопками)
[ ] Заменить toast.error в useLogin, useRegister, useForgotPassword, useResetPassword → FormAlert
[ ] useLogin: 401 + !isVerified → FormAlert warning + action "Resend email"
[ ] useLogin: 429 → FormAlert warning с Retry-After таймером
[ ] Страница "Check your email" → StatusScreen info + кнопка "Resend"
[ ] Страница "Email verified" → StatusScreen success + кнопка "Sign in"
```

### Рефакторинг auth компонентов — использовать shared UI

Auth формы используют сырые HTML теги вместо компонентов из `@org/shared`:

| Файл                       | Что заменить                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `login-form.tsx`           | `<p className="text-sm text-text-muted">` → `<Text size="sm" color="muted">`                                               |
| `register-form.tsx`        | `<p className="text-sm text-text-muted">` → `<Text size="sm" color="muted">`                                               |
| `forgot-password-form.tsx` | 2× `<p>` → `<Text>`                                                                                                        |
| `reset-password-form.tsx`  | `<p className="text-sm text-danger">` → `<Text size="sm" color="danger">`, description `<p>` → `<Text>`                    |
| `oauth-buttons.tsx`        | `<button className="inline-flex...border-border bg-surface-elevated...">` → `<Button variant="secondary" leftIcon={icon}>` |

```
[ ] Заменить <p> теги на <Text> во всех auth формах
[ ] OAuthButtons: заменить <button> на <Button variant="secondary" leftIcon={icon}>
[ ] Проверить другие компоненты в features/widgets на сырые теги
```

### Lazy loading

```
[ ] React.lazy() для всех страниц в роутере
[ ] Suspense с Spinner на уровне роутера
[ ] Проверить bundle size до/после
```

### Производительность компонентов

```
[ ] ChatList → React.memo (ре-рендер при каждом новом сообщении)
[ ] MessageList → виртуализация если сообщений много (react-virtual или @tanstack/virtual)
[ ] useCallback для обработчиков в ChatItem, MessageBubble
[ ] Проверить нет ли лишних ре-рендеров (React DevTools Profiler)
```

### es-toolkit

```
[ ] Найти использование нативных паттернов которые es-toolkit делает чище:
    - debounce для typing indicator (сейчас нет реализации)
    - groupBy для группировки сообщений по дате
    - chunk для пагинации
[ ] use-chat-list.ts: поиск — проверить нет ли лишних операций
```

---

## БЛОК 9: Documentation

### Swagger (бэкенд)

```
[ ] @nestjs/swagger уже установлен (не используется)
[ ] Подключить SwaggerModule в gateway/main.ts
[ ] Добавить @ApiTags, @ApiOperation, @ApiResponse к контроллерам
[ ] Добавить @ApiProperty к DTO (через createZodDto уже частично)
[ ] Доступно на /api/docs
```

### Storybook (фронтенд)

```
[ ] Storybook уже установлен
[ ] Stories для: Button, Input, ChatItem, MessageBubble, LoginForm, RegisterForm
[ ] Показывать состояния: loading, error, empty, filled
```

---

## БЛОК 10: E2E (Playwright)

```
[ ] Register → check email page → (mock verify) → /chats
[ ] Login → /chats → send message → message appears
[ ] Login с неверным паролем → inline error
[ ] Refresh token: мокаем 401 → auto refresh → запрос проходит
[ ] Logout → /auth/login
[ ] Password reset flow
```

---

## Порядок выполнения

```
Блок 1:  Auth Register + Email Verification  (баги → доработки → тесты)
Блок 2:  Auth Login                          (доработки → тесты)
Блок 3:  Auth Logout / Refresh / Reset       (доработки → тесты)
Блок 4:  Auth Brute Force                    (обсудить Redis vs Postgres → реализация → тесты)
Блок 5:  OAuth                               (credentials → тесты)
Блок 6:  User Set Password                   (новый endpoint → фронт → тесты)
Блок 7:  Chat Advanced                       (online / unread / typing → тесты)
Блок 8:  Frontend UX + оптимизация           (lazy / memo / es-toolkit / error UX)
Блок 9:  Documentation                       (Swagger + Storybook)
Блок 10: E2E                                 (финальный прогон)
```

---

## БЛОК 11: Frontend Monitoring (последний этап)

```
[ ] GlitchTip (self-hosted, Sentry-совместимый) добавить в docker-compose
[ ] @sentry/react + @sentry/vite-plugin установить в root package.json
[ ] Sentry.init() в apps/client/messenger/src/main.tsx (DSN из env VITE_SENTRY_DSN)
[ ] ErrorBoundary с Sentry.ErrorBoundary вокруг приложения
[ ] Sentry.setUser({ id }) после логина, clearUser() после logout
[ ] source maps upload в vite.config.mts через @sentry/vite-plugin
[ ] Обернуть в @org/shared: initMonitoring(), captureError() чтобы не импортировать @sentry/react напрямую
```

---

## Вне MVP

- Media service

---

## Открытые вопросы (требуют ответа)

1. **Brute force порог**: 5 попыток / 15 минут — устраивает?
2. **Email resend cooldown**: 2 минуты — устраивает?
3. **Password reset cooldown**: 5 минут — устраивает?
4. **Email verify токены**: всегда свежая пара ✅
5. **Login без верификации**: 401 с сообщением "Please verify your email" — согласовано ✅
6. **Error UX**: решено ✅ — см. БЛОК 8
7. **Notification service Prisma**: оставить — пригодится для in-app уведомлений ✅
