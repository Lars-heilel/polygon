# API Gateway — Техническое задание

> **Статус:** 🟡 Почти готово  
> **Назначение:** Единая точка входа для клиента. HTTP + WebSocket.

---

## 1. Бизнес-функции

- Маршрутизация HTTP-запросов в бэкенд-сервисы
- Аутентификация JWT через HttpOnly cookies
- WebSocket для real-time (чат, звонки)
- OAuth редиректы (GitHub, Google)
- Swagger документация (dev-режим)

## 2. Важные нюансы

- **JWT аутентификация** — access_token в HttpOnly cookie, не доступен из JS. Refresh — ротация с защитой от replay attack.
- **Instant revoke сессий** — после отзыва сессии Redis проверяется при каждом запросе. Если сессии нет в Redis — 401.
- **Rate limiting** — 100 запросов / 60 сек глобально.
- **WebSocket** — аутентификация по access_token из cookie при connect. При disconnect → статус пользователя offline.
- **Ошибки** — требуется глобальный Exception Filter для нормализации ответов об ошибках.

## 3. Статус реализации

| Компонент | Статус |
|-----------|--------|
| HTTP-роутинг (5 контроллеров) | ✅ Готово |
| JWT аутентификация | ✅ Готово |
| OAuth (GitHub, Google) | ✅ Готово |
| Rate limiting | ✅ Готово |
| WebSocket (чат, typing, online) | ✅ Готово |
| Swagger docs | ✅ Готово |
| Global Exception Filter | 📝 Надо |
| Instant revoke (Redis check) | 📝 Надо |
| Ролевая модель (RolesGuard) | 📝 Надо |
