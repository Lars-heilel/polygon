# SPEC-2 — search-service (Meili-синк, своей БД нет)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Второй из шести. Один сервис целиком: prisma → контракты → репозиторий → сервис+Redis → контроллер → фронт.
Общая преамбула типов — см. `2026-09-13-notification-design.md` §0 (uuid v7, tight-VarChar,
контракты-first, транспортное разделение, логи, тесты).

## 1. Цель

Идемпотентный синк пользователей в Meilisearch на событиях `user.registered/updated/deleted`,
поиск `search.users` с tight-лимитами запроса.

## 2. Scope / Non-goals

- В скоупе: `search.service`, `search.controller`, Meili-индекс `{ id, name, displayName, avatarUrl }`,
  gateway `search`-контроллер, `features-search` на фронте.
- Вне скоупа: полнотекст по сообщениям, своя Postgres-БД (её нет и не заводим — one service
  one database не требует пустую БД ради галочки).

## 3. Prisma

Нет `schema.prisma` — фиксируем fact'ом: Postgres не заводим. Если линтер/CI требует
`prisma-generate` таргет — стаб с пустой схемой не создаём, вместо этого документируем
исключение в project-конфиге при реализации.

## 4. Контракты (`libs/common`)

- `search-users-query.schema.ts`: `q: z.string().min(1).max(128)`, `limit .max(50)` —
  режем тяжёлые запросы на gateway до RMQ/Meili.
- `user-search-result.schema.ts`: `id: z.uuid()`, `name .max(32)`, `displayName .max(64)`,
  `avatarUrl .max(2048).nullable()` — зеркало tight-лимитов user-спеки.
- События `user.registered/updated/deleted` (`create-user-event.schema.ts`): без изменений
  формы, только проверка `.max()` на именах в соответствии с user-спекой.

## 5. Репозиторий

Слой репозитория = Meili-обёртка за интерфейсом + DI-токеном (заменяемость per DEVELOPMENT §5.1):
`upsertUsers`, `deleteUser`, `searchUsers`, `reindexUsers`. Батч-апсерты при реиндексе,
а не по одному.

## 6. Сервис + Redis

- Event-хендлеры синка идемпотентны по `userId` (upsert/delete, не blind-create) —
  переживают ределивери брокера.
- Redis: `search:reindex:lock` (SET NX EX 300) на время полного реиндекса, чтобы два
  реиндекса не шли параллельно. Обычный поиск stateless, кэш результатов не вводим
  (инвалидация дороже выигрыша на этом объёме).

## 7. Контроллеры

- Lib: `@EventPattern` для `user.*` (синк), `@MessagePattern` для `search.users`/`reindexUsers`
  (нужен результат для HTTP-ответа). Не путать.
- Gateway: `GET search/users` → `client.send`, guards-цепочка стандартная
  (Throttler → Session → ActiveAccount), ответ — массив `UserSearchResult`.

## 8. Фронт

- `features-search`: дебаунс запроса, отмена устаревших (single-flight), запрос через `API_ROUTES`.
  Пагинацию не добавляем (лимит 50 достаточен для дропдауна).

## 9. Тесты

- Unit: хендлеры синка (ределивери → один документ), `searchUsers` маппинг, lock реиндекса (мок Redis).
- Gateway HTTP: supertest с мокнутым RMQ-клиентом.

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`.
- Реиндекс после деплоя: один прогон `reindexUsers` (идемпотентен).
