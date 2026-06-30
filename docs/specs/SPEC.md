# Polygon Messenger — Техническое задание

> **Статус:** 🚧 В разработке  
> **Версия:** 1.0.0

---

## 1. О продукте

Polygon Messenger — масштабируемый мессенджер с архитектурой микросервисов.

**Ключевые возможности:**
- Регистрация и аутентификация (email/password + OAuth GitHub/Google/Yandex)
- Обмен текстовыми сообщениями, файлами, медиа
- Групповые чаты
- Аудио/видео звонки
- Real-time доставка сообщений
- Внутричатовая медиа-галерея
- Поиск по пользователям и сообщениям
- Push-уведомления
- PWA (Progressive Web App)

---

## 2. Карта систем

| Система | Описание | Статус |
|---------|----------|--------|
| [API Gateway](./gateway-service.md) | Единая точка входа: HTTP-роутинг, WebSocket, JWT-аутентификация | 🟡 |
| [Auth Service](./auth-service.md) | Аутентификация, OAuth, сессии, верификация | 🟢 |
| [User Service](./user-service.md) | Профили, статусы, блокировки | 🟡 |
| [Chat Service](./chat-service.md) | Чаты, сообщения, пересылка, файлы, звонки | 🔴 |
| [Media Service](./media-service.md) | Файлы, MinIO, превью, waveform | 🟡 |
| [Notification Service](./notification-service.md) | Email, Push-уведомления | 🔴 |
| [Search Service](./search-service.md) | Поиск пользователей и сообщений | 🔴 |
| [Client Messenger](./client-messenger.md) | React SPA, PWA, Socket.IO | 🔴 |
| [Infrastructure](./infrastructure.md) | Docker, мониторинг | 🟡 |

---

## 3. Архитектура

Микросервисная архитектура:
- Каждый сервис имеет свою БД
- Межсервисное взаимодействие — асинхронное через RabbitMQ
- Клиент → Gateway (HTTP/WS) → RabbitMQ → сервисы
- Единые схемы валидации для клиента и бэкенда

Подробная архитектура: [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
Соглашения и подходы: [docs/DEVELOPMENT.md](../DEVELOPMENT.md)

---

## 4. Статусная карта

```
🟢 Готово       — реализовано и работает
🟡 Почти готово — работает, но требует доработок
🔴 В разработке  — требуется реализация
❌ Отложено      — запланировано на будущее
```
