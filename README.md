# Polygon Platform

**Микросервисная платформа для коммуникаций**

[Настройки окружения](./SETUP.md) • [Для разработчиков](./docs/DEVELOPMENT.md) • [Для AI агентов](./docs/AI-AGENTS.md) • [Архитектура](./docs/ARCHITECTURE.md)

---

## 🚀 Быстрый старт

```bash
# Клонировать репозиторий
git clone <repository-url>
cd polygon

# Инициализировать окружение (первый запуск)
./scripts/bootstrap.sh

# Готово! Сервисы запущены
```

**Подробная инструкция:** [Настройка окружения →](./SETUP.md)

---

## 📦 Что внутри

| Сервис | Порт | Описание |
|--------|------|----------|
| **User** | 3001 | Управление пользователями |
| **Auth** | 3002 | Аутентификация и авторизация |
| **Chat** | 3003 | Чаты и сообщения |
| **Media** | 3004 | Работа с медиафichiers |
| **Notification** | 3005 | Уведомления |

**Инфраструктура:**
- PostgreSQL (5432) — базы данных
- Redis (6379) — кэширование
- RabbitMQ (5672/15672) — брокер сообщений

---

## 📚 Документация

### Для разработчиков
| Файл | Описание |
|------|----------|
| [**SETUP.md**](./SETUP.md) | Настройка окружения, переменные, запуск |
| [**docs/DEVELOPMENT.md**](./docs/DEVELOPMENT.md) | Гайд по разработке, стандарты кода, тесты |
| [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md) | Архитектура проекта, связи сервисов |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | Как вносить изменения, PR, кодстайл |

### Для AI агентов
| Файл | Описание |
|------|----------|
| [**docs/AI-AGENTS.md**](./docs/AI-AGENTS.md) | Гайд для AI ассистентов (Qwen, Cursor, Copilot) |
| [**AGENTS.md**](./AGENTS.md) | Конфигурация Nx и навыки агентов |

---

## 🛠 Технологии

- **Backend:** NestJS, TypeScript, Prisma
- **Database:** PostgreSQL, Redis
- **Message Broker:** RabbitMQ
- **Monorepo:** Nx
- **Container:** Docker, Docker Compose

---

## 📋 Лицензия

MIT

---

# Polygon Platform

**Microservices communication platform**

[Environment Setup](./SETUP.md) • [For Developers](./docs/DEVELOPMENT.md) • [For AI Agents](./docs/AI-AGENTS.md) • [Architecture](./docs/ARCHITECTURE.md)

---

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd polygon

# Initialize environment (first run)
./scripts/bootstrap.sh

# Done! Services are running
```

**Full guide:** [Environment Setup →](./SETUP.md)

---

## 📦 What's Inside

| Service | Port | Description |
|---------|------|-------------|
| **User** | 3001 | User management |
| **Auth** | 3002 | Authentication & authorization |
| **Chat** | 3003 | Chats & messaging |
| **Media** | 3004 | Media handling |
| **Notification** | 3005 | Notifications |

**Infrastructure:**
- PostgreSQL (5432) — databases
- Redis (6379) — caching
- RabbitMQ (5672/15672) — message broker

---

## 📚 Documentation

### For Developers
| File | Description |
|------|-------------|
| [**SETUP.md**](./SETUP.md) | Environment setup, variables, running |
| [**docs/DEVELOPMENT.md**](./docs/DEVELOPMENT.md) | Development guide, code standards, tests |
| [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md) | Project architecture, service connections |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | How to contribute, PRs, code style |

### For AI Agents
| File | Description |
|------|-------------|
| [**docs/AI-AGENTS.md**](./docs/AI-AGENTS.md) | Guide for AI assistants (Qwen, Cursor, Copilot) |
| [**AGENTS.md**](./AGENTS.md) | Nx configuration and agent skills |

---

## 🛠 Tech Stack

- **Backend:** NestJS, TypeScript, Prisma
- **Database:** PostgreSQL, Redis
- **Message Broker:** RabbitMQ
- **Monorepo:** Nx
- **Container:** Docker, Docker Compose

---

## 📋 License

MIT
