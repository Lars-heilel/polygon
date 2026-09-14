# E2EE (X3DH + Double Ratchet) + IndexedDB message cache — Design

Date: 2026-09-14. Status: approved (all 5 sections).
Scope: frontend message caching in IndexedDB + full E2E encryption.
Decisions: X3DH + Double Ratchet обязательны, бэкенд пашет на полную,
мультидевайс сохраняется (выпиливать — плохое решение).

## 1. Криптомодель

- **X3DH** — только установка 1:1-сессий между парами устройств.
  Публичное (identity key, signed prekey + signature, one-time prekeys)
  хранится на бэкенде как prekey bundle. Приватное никогда не покидает устройство.
- **Double Ratchet** — попарно на каждую пару устройств
  sender-device ↔ recipient-device: уникальный message-key на сообщение (HKDF),
  удаление после использования, DH-ratchet каждые N сообщений.
  Свойства: forward secrecy + post-compromise security.
- **Группы — Sender Keys**: у каждого устройства-отправителя свой chain-key
  на чат; раздаётся один раз каждому устройству-участнику через их 1:1-каналы.
  Сообщения шифруются под chain-key с `keyId + counter`.
- **Мультидевайс**: устройство = отдельная Signal-идентичность
  (`userId + deviceId`). Бэкенд хранит реестр устройств и prekey bundles.
  Отправка = fan-out по всем устройствам получателей.
- **Вложения**: шифруются тем же message-key (AES-GCM, свежий IV на сообщение);
  MinIO хранит только ciphertext.

## 2. Контракты (`libs/common`, contracts-first)

Новые zod-схемы:

- `device`: `userId, deviceId, identityKey, registrationId`.
- `prekeyBundle`: `identityKey, signedPrekey + signature, oneTimePrekey`.
- `envelope` (1:1): `senderDeviceId, recipientDeviceId, ciphertext, iv,
  keyVersion/counter, ratchetHeader`.
- `groupEnvelope`: `senderDeviceId, chainKeyId, counter, ciphertext, iv`.
- `senderKeyDistribution`: `chainKey, keyId`, для каждого recipient-device
  зашифрованная его 1:1-сессией.

Изменения существующих:

- `sendMessageSchema` расширяется envelope-полями; `text` — nullable/opaque,
  сервер содержимое не валидирует.
- `messageSchema` хранит только ciphertext-обёртку.
- `API_ROUTES`: `devices/prekeys` (publish/consume),
  `sender-keys` (distribute/rotate).

Правило: бэкенд wraps (`createZodDto`), фронт extends (`.extend()`).
Никаких хардкод-роутов и форков схем.

## 3. Бэкенд (полная работа)

`chat-service` Prisma (своя БД `polygon_chat`, свой `*_DATABASE_URL`):

- `Device`: `userId, deviceId, identityKey, registrationId, lastSeen`.
- `PreKeyBundle`: `deviceId, signedPrekey, signature, oneTimePrekeys[]`
  (consume-once semantics).
- `SenderKeyRecord`: `chatId, senderDeviceId, keyId, encryptedShares`.

Новые паттерны (`libs/backend/core/src/constants/queues/chat.queue.ts`):

- `device.register / device.revoke`
- `prekeys.publish / prekeys.consume`
- `senderKey.distribute / senderKey.rotate`
- `message.sendEnvelope` — принимает только ciphertext + membership-check
  + запись; чтения содержимого нет.

Gateway (тонкий прокси + оркестрация, `controllers: []` в apps):

- HTTP-прокси на новые паттерны.
- `chat.socket-gateway`: `message:send` принимает envelope-пачку
  на все recipient-devices, рассылает по комнатам `chat:{id}`.
- Offline-push деградирует до «Новое сообщение» (без body).
- Поиск по тексту сообщений и link-preview для шифрочатов отключаются.
- Ротация при kick/leave: `senderKey.rotate` + revoke shares ушедшего.
- Guards порядок: Throttler → Session/Jwt → ActiveAccount → Roles.
- Ошибки: сервисы кидают RPC `{ message, status }`, gateway мапит в HttpException.

## 4. Фронт (FSD, heavy-deps правило)

Новые пакеты (app-agnostic, свой `package.json`, `sideEffects: false`):

- **`@org/crypto-e2ee`** — единственный владелец WebCrypto + Double Ratchet
  state. Non-extractable identity/device ключи в IndexedDB, sessions и
  sender-chains в отдельных stores. Крипта — свой код на
  WebCrypto (AES-GCM + X25519/HKDF); если потянем внешнюю libsignal-зависимость
  >30KB — только отдельным пакетом с единственным entry + потребление через
  `lazy()`, ноль статических импортёров в eager-графе (проверка visualizer +
  Network).
- **`@org/message-cache`** — idb-обёртка: stores `messages` (индекс
  `chatId + createdAt`), `chats-meta` (`lastSync/sinceId`), LRU-вычистка
  (лимит ~200 сообщений на чат).

Интеграция (слои строго вниз, через public API `index.ts`):

- `entities-message`: decrypt после fetch/delta перед `normalizeMessage`;
  в кэше — расшифрованное + envelope для повторного рендера.
- `features/send-message`: encrypt перед `socket.emit` (fan-out envelopes
  по devices).
- `features/chat-socket`: decrypt `message:new` + запись в кэш и
  React Query `['messages', chatId]`.
- Ключи non-extractable; `deviceId` на логин, revoke при logout.
- Логи только через `frontendLog`, без `console.*`; секреты/сырые id не логаем.

## 5. Синхронизация / ошибки / тесты / фазы

- Кэш: read + delta-sync. Холодный старт отдаёт IndexedDB мгновенно,
  затем `getDelta(since/sinceId)` → decrypt → патч страниц.
  Инвалидация по socket `message:new/updated/deleted` + `markRead`.
  Outbox для офлайн-отправки НЕ делаем (только чтение).
- Ошибки: undecryptable → плейсхолдер «Не удалось расшифровать» +
  retry-key-fetch; out-of-order counter → запрос resync sender-chain.
- Тесты (спеки в `__tests__/` рядом, моки в `__mocks__/`):
  crypto-векторы X3DH/ratchet, eviction кэша, контракт envelope;
  gateway — supertest поверх моков RMQ (`{ send: jest.fn() }`),
  без живого брокера/БД/Redis в юнит-прогоне.
- Verify: `npm exec nx -- affected --target=test`, `npm run format:check`,
  visualizer/Network-чек чанков.
- Фазы: 1) контракты + бэкенд devices/prekeys; 2) crypto-пакет + 1:1;
  3) sender-keys + группы + ротация; 4) message-cache + delta.
