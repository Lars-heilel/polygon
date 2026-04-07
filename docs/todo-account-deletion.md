# TODO: Account Deletion & Restoration Feature

## Контекст

Фича удаления аккаунта пользователем. Soft delete с периодом восстановления 6 месяцев.
Hard delete оставлен в репозитории до реализации фичи.

---

## Схема (user-service)

Добавить поле в `libs/backend/user/src/database/prisma/schema.prisma`:

```prisma
model User {
  // ... существующие поля
  deletedAt DateTime?   // null = активен, дата = soft deleted
}
```

Запустить миграцию: `cd libs/backend/user && npx prisma migrate dev`

---

## Репозиторий (libs/backend/user)

- [ ] Добавить `softDelete(id: string): Promise<void>` в `IUserRepository` и `UserPrismaRepository`
  - `data: { deletedAt: new Date() }`
- [ ] `findById` — добавить `where: { deletedAt: null }`
- [ ] `findPublicById` — добавить `where: { deletedAt: null }`
- [ ] `findAllPublic` — добавить `where: { deletedAt: null }`
- [ ] Удалить `delete(id)` (hard delete) из репозитория и интерфейса когда softDelete готов

---

## Сервис (libs/backend/user)

- [ ] Добавить `softDelete(id: string): Promise<void>` в `IUserService` и `UserService`
  - Вызывает `repo.softDelete(id)`
  - Emits `USER_EVENTS.DELETED` → search-service убирает из индекса
  - Внедрить `SEARCH_CLIENT_TOKEN` в `UserService`

---

## Паттерны и события (libs/backend/core)

- [ ] Добавить `USER_PATTERNS.DELETE_REQUEST` — запросить подтверждение удаления
- [ ] Добавить `USER_PATTERNS.DELETE_CONFIRM` — подтвердить удаление по токену
- [ ] Добавить `USER_PATTERNS.RESTORE` — восстановить аккаунт (вызывается из auth-service)
- [ ] Добавить `USER_EVENTS.DELETED` — soft delete подтверждён (слушают search-service, auth-service)
- [ ] Добавить `USER_EVENTS.PURGED` — hard delete после 6 месяцев (слушает auth-service)

---

## Verification tokens (libs/backend/core или auth)

Использовать существующий `VerificationService` (Redis), добавить два типа токенов:

- [ ] `DELETE_CONFIRM` — TTL 1 час, отправляется на email при запросе удаления
- Restore-токен не нужен — восстановление идёт через попытку входа с паролем

---

## Gateway (apps/backend/gateway)

- [ ] `DELETE /users/me` → `USER_PATTERNS.DELETE_REQUEST`
  - Генерирует токен подтверждения, отправляет письмо через notification-service
  - Возвращает `{ message: 'Check your email to confirm deletion' }`
- [ ] `POST /users/me/delete-confirm` `{ token: string }` → `USER_PATTERNS.DELETE_CONFIRM`
  - user-service: soft delete
  - auth-service: revoke all refresh tokens

---

## Auth-service (libs/backend/auth)

### При удалении аккаунта

- [ ] Слушать `USER_EVENTS.DELETED` → `repo.revokeAllRefreshTokens(id)`

### При попытке входа (validateCredentials)

- [ ] После проверки пароля — отправить `USER_PATTERNS.GET_BY_ID` в user-service
- [ ] Если `deletedAt != null` → вернуть `403 { code: 'ACCOUNT_DELETED' }`

### Восстановление

- [ ] `POST /auth/restore` `{ email, password }`
  - Проверить пароль
  - Отправить `USER_PATTERNS.RESTORE` в user-service
  - user-service: `deletedAt = null`
  - search-service: вернуть в индекс (emit `USER_EVENTS.REGISTERED` или отдельное событие)
  - Выдать новую пару токенов

---

## Notification-service

- [ ] Шаблон письма: подтверждение удаления аккаунта
  - Ссылка/код действителен 1 час
  - Предупреждение: аккаунт будет окончательно удалён через 6 месяцев

---

## Cron-job: очистка после 6 месяцев

- [ ] Добавить scheduled task (например в user-service или отдельный worker)
  - Раз в день: `findMany({ where: { deletedAt: { lt: subMonths(new Date(), 6) } } })`
  - Hard delete каждой записи
  - Emit `USER_EVENTS.PURGED` → auth-service удаляет credentials

---

## Клиент (apps/client/messenger)

- [ ] Обрабатывать `403 { code: 'ACCOUNT_DELETED' }` на странице логина
  - Показывать: "Аккаунт удалён. Восстановить?" с кнопкой
  - Кнопка вызывает `POST /auth/restore` с теми же кредами
- [ ] Настройки аккаунта: кнопка "Удалить аккаунт"
  - Открывает подтверждение → `DELETE /users/me`
  - Показывает: "Письмо с подтверждением отправлено на вашу почту"
