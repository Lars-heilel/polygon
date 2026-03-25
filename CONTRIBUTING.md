# Внесение изменений / Contributing

[← На главную](./README.md) | [Для разработчиков](./docs/DEVELOPMENT.md) | [Для AI агентов](./docs/AI-AGENTS.md)

---

## 🌟 Как внести свой вклад

### 1. Ветвление

```bash
# Основная ветка
git checkout main
git pull

# Создать ветку для фичи
git checkout -b feature/my-new-feature

# Или для исправления бага
git checkout -b fix/bug-description
```

**Формат веток:**
- `feature/<description>` — новая функциональность
- `fix/<description>` — исправление бага
- `refactor/<description>` — рефакторинг
- `docs/<description>` — документация
- `chore/<description>` — настройки, конфиги

---

### 2. Разработка

```bash
# Внести изменения в код

# Запустить линт
npx nx lint <project>

# Запустить тесты
npx nx test <project>

# Убедиться, что сборка проходит
npx nx build <project>
```

**Чеклист перед коммитом:**
- [ ] Код проходит линтинг
- [ ] Тесты проходят
- [ ] Сборка без ошибок
- [ ] Документация обновлена (если нужно)

---

### 3. Коммиты

**Формат commit messages:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Типы коммитов:**
- `feat` — новая функциональность
- `fix` — исправление бага
- `refactor` — рефакторинг
- `docs` — документация
- `style` — форматирование
- `test` — тесты
- `chore` — настройки

**Примеры:**
```bash
feat(user): add user profile endpoint

fix(auth): resolve token expiration issue

docs: update SETUP.md with new instructions

refactor(chat): improve message repository performance
```

---

### 4. Pull Request

```bash
# Запушить ветку
git push origin feature/my-new-feature

# Создать PR через GitHub/GitLab UI
```

**Шаблон PR:**
```markdown
## Описание
Краткое описание изменений

## Тип изменений
- [ ] Новая функциональность
- [ ] Исправление бага
- [ ] Рефакторинг
- [ ] Документация

## Чеклист
- [ ] Код отлинтован
- [ ] Тесты проходят
- [ ] Сборка без ошибок
- [ ] Документация обновлена

## Скриншоты (если применимо)

## Related issues
Closes #123
```

---

## 📝 Стандарты кода

### TypeScript
- Строгая типизация (`strict: true`)
- Явные возвращаемые типы
- Интерфейсы для DTO

### NestJS
- Декоративный стиль
- Repository pattern для БД
- DI через конструктор

### Именование
```typescript
// Файлы
user.service.ts          // kebab-case
user-prisma.repo.ts

// Классы
class UserService {}     // PascalCase

// Функции/переменные
const getUserById = () => {}  // camelCase

// Константы
const MAX_COUNT = 100    // UPPER_SNAKE_CASE
```

---

## 🧪 Тестирование

```bash
# Запустить все тесты
npm run test

# Запустить тесты сервиса
npx nx test user

# Запустить с покрытием
npx nx test user --coverage

# Запустить конкретный тест
npx nx test user --testFile=user.service.spec.ts
```

---

## 🔍 Code Review

**Что проверяем:**
- Соответствие стандартам кода
- Наличие тестов
- Читаемость кода
- Отсутствие дублирования
- Безопасность (нет ли уязвимостей)

**Как ревьюить:**
- Конструктивные комментарии
- Предлагать улучшения
- Указывать на лучшие практики

---

# Contributing

[← Home](./README.md) | [For Developers](./docs/DEVELOPMENT.md) | [For AI Agents](./docs/AI-AGENTS.md)

---

## 🌟 How to Contribute

### 1. Branching

```bash
# Main branch
git checkout main
git pull

# Create feature branch
git checkout -b feature/my-new-feature

# Or for bug fix
git checkout -b fix/bug-description
```

**Branch naming:**
- `feature/<description>` — new feature
- `fix/<description>` — bug fix
- `refactor/<description>` — refactoring
- `docs/<description>` — documentation
- `chore/<description>` — configs

---

### 2. Development

```bash
# Make code changes

# Run lint
npx nx lint <project>

# Run tests
npx nx test <project>

# Ensure build passes
npx nx build <project>
```

**Pre-commit checklist:**
- [ ] Code passes linting
- [ ] Tests pass
- [ ] Build without errors
- [ ] Documentation updated (if needed)

---

### 3. Commits

**Commit message format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Commit types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — refactoring
- `docs` — documentation
- `style` — formatting
- `test` — tests
- `chore` — configs

**Examples:**
```bash
feat(user): add user profile endpoint

fix(auth): resolve token expiration issue

docs: update SETUP.md with new instructions

refactor(chat): improve message repository performance
```

---

### 4. Pull Request

```bash
# Push branch
git push origin feature/my-new-feature

# Create PR via GitHub/GitLab UI
```

**PR Template:**
```markdown
## Description
Brief description of changes

## Change Type
- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation

## Checklist
- [ ] Code linted
- [ ] Tests pass
- [ ] Build without errors
- [ ] Documentation updated

## Screenshots (if applicable)

## Related issues
Closes #123
```

---

## 📝 Code Standards

### TypeScript
- Strict typing (`strict: true`)
- Explicit return types
- Interfaces for DTOs

### NestJS
- Decorator style
- Repository pattern for DB
- Constructor-based DI

### Naming
```typescript
// Files
user.service.ts          // kebab-case
user-prisma.repo.ts

// Classes
class UserService {}     // PascalCase

// Functions/variables
const getUserById = () => {}  // camelCase

// Constants
const MAX_COUNT = 100    // UPPER_SNAKE_CASE
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run service tests
npx nx test user

# Run with coverage
npx nx test user --coverage

# Run specific test
npx nx test user --testFile=user.service.spec.ts
```

---

## 🔍 Code Review

**What to check:**
- Code standards compliance
- Test coverage
- Code readability
- No duplication
- Security (no vulnerabilities)

**How to review:**
- Constructive comments
- Suggest improvements
- Point to best practices

---
