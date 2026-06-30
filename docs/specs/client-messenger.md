# Client (Messenger SPA) — Техническое задание

> **Статус:** 🔴 В разработке  
> **Назначение:** Веб-интерфейс мессенджера. PWA, real-time

---

## 1. Бизнес-функции

### Level 1 — Auth & Core
- Login, Register, OAuth (GitHub, Google, Yandex)
- Forgot / Reset password, Email verification
- Управление сессиями (просмотр, отзыв)
- Список чатов (поиск, online-фильтр)
- Окно чата (сообщения, пагинация)
- Отправка текста + файлов
- Voice recorder + Circle recorder
- Emoji picker
- Просмотр / редактирование профиля
- Настройки (general, privacy, devices)
- Темы dark/light

### Level 2 — Messages UX
- Редактирование сообщений (inline, badge "изменено")
- Удаление (контекстное меню: for all / for me)
- Link preview (карточка ссылки)
- Аудио/voice плеер (waveform, скорость, перемотка)
- Видео плеер (inline, fullscreen, circle mask)
- Поиск по чату (строка поиска + подсветка)
- Unread count (badge + "N новых" в окне)

### Level 3 — Media Gallery
- Вкладки в чате: Медиа / Файлы / Аудио / Видео / Ссылки
- Сетка миниатюр для медиа
- Табличный вид для файлов (имя, размер, дата)

### Level 4 — Social
- Статус (online/away/dnd/invisible)
- Last seen display
- Блокировка пользователя
- Placeholder avatar (initials)

### Level 5 — Groups ★
- Create group modal (участники, имя, аватар)
- Group header (список участников, roles)
- Приглашение / kick
- Mute / block

### Level 6 — Calls ★
- Кнопка звонка в header чата
- Call overlay (аватар, таймер, mute, speaker, end)
- P2P / групповые аудио/видео звонки

### Level 7 — PWA ★
- Service Worker (cache, offline)
- Push notifications (Web Push API)

### Level 8 — Polish
- Skeleton screens при загрузке
- Empty states ("Нет сообщений", "Нет чатов")
- Mobile адаптация
- Анимации
- Мультиязычность (i18n) — будущее

## 2. Ключевые бизнес-сценарии

### Первое включение
```
1. Пользователь открывает приложение
2. Проверка сессии (есть ли access_token cookie)
3. Если нет → редирект на /auth/login
4. Если есть → /chats
```

### Отправка сообщения
```
1. Пользователь вводит текст / выбирает файл
2. Отправка — сообщение появляется сразу (optimistic update)
3. WebSocket рассылает собеседникам
4. При ошибке — сообщение помечается красным, можно повторить
```

### Real-time обновления
```
1. Новое сообщение — в списке чатов обновляется превью + unread count
2. Собеседник печатает — typing indicator
3. Собеседник онлайн / офлайн — статус в шапке чата
4. Push-уведомление, если приложение неактивно
```

---

## 3. Acceptance Criteria / Expected Behavior

### TC-CLIENT-1: App Guard — Session Bootstrap

**Preconditions:**
- Пользователь открывает https://messenger.app

**Flow (есть сессия):**
1. Открывается приложение → спиннер на весь экран (1-2 сек)
2. GET /api/users/me → 200 (сессия валидна)
3. Редирект на /chats → список чатов загружен

**Flow (нет сессии):**
1. Открывается приложение → спиннер (1-2 сек)
2. GET /api/users/me → 401
3. Редирект на /auth/login → форма входа

**Edge cases:**
- **Refresh token работает:** access_token просрочен → authedFetch делает refresh без участия пользователя
- **Refresh не работает:** редирект на логин

---

### TC-CLIENT-2: Мобильная адаптация

**Preconditions:**
- Пользователь открывает приложение на телефоне (viewport < 768px)

**Flow:**
1. Список чатов на весь экран (без sidebar desktop)
   → Bottom tab bar: Чаты, Контакты, Настройки
2. Пользователь тапает на чат
   → Чат открывается на весь экран
   → Кнопка "Назад" в шапке → возврат к списку чатов
3. Пользователь переворачивает телефон:
   → На планшете (landscape): sidebar + чат рядом (как на десктопе)

---

### TC-CLIENT-3: PWA — Install prompt

**Preconditions:**
- Пользователь открывает приложение в Chrome на Android
- Посетил страницу 2+ раза с интервалом > 5 минут

**Flow:**
1. Появляется bottom sheet: "Установить Messenger?"
2. Пользователь нажимает "Установить"
   → Приложение устанавливается как standalone PWA
   → Иконка на домашнем экране
   → Открывается без адресной строки браузера

---

### TC-CLIENT-4: Empty states

**Preconditions:**
- У нового пользователя нет чатов, нет сообщений

**Flow:**
1. Пользователь заходит в /chats впервые
   → EmptyState: "У вас пока нет чатов. Начните новый диалог"
   → Кнопка "Новый чат"
2. Пользователь создаёт чат, но сообщений ещё нет
   → EmptyState: "Нет сообщений. Напишите что-нибудь!"

---

## 4. Важные нюансы

- **Подход FSD** — каждый слой изолирован (shared → entities → features → widgets → layouts → pages). Чёткие границы через Nx module boundaries.
- **Zustand** — для клиентского состояния (сессия, активный чат, presence). TanStack Query — для серверных данных (чаты, сообщения).
- **Socket.IO** — подключается при логине, отключается при логауте. middleware через подписку на store.
- **Auth через cookies** — никакие токены не хранятся в JS. За refresh отвечает `authedFetch` — при 401 автоматически пытается обновить.
- **Optimistic updates** — сообщение показывается сразу, при ошибке — откат.

## 4. Статус реализации

| Фича | Статус |
|------|--------|
| Auth flow | ✅ Готово |
| Чат-лист | ✅ Готово |
| Сообщения | ✅ Готово |
| Upload файлов | ✅ Готово |
| Voice recorder | ✅ Готово |
| Circle recorder | ✅ Готово |
| Emoji picker | ✅ Готово |
| Профиль / Настройки | ✅ Готово |
| Темы dark/light | ✅ Готово |
| Socket.IO real-time | ✅ Готово |
| Edit message ★ | 📝 Надо |
| Delete message ★ | 📝 Надо |
| Link preview ★ | 📝 Надо |
| Audio/voice player ★ | 📝 Надо |
| Video player ★ | 📝 Надо |
| Circle player ★ | 📝 Надо |
| Media gallery ★ | 📝 Надо |
| Message search ★ | 📝 Надо |
| Unread count ★ | 📝 Надо |
| Status/presence ★ | 📝 Надо |
| Last seen ★ | 📝 Надо |
| Block user ★ | 📝 Надо |
| Group chat UI ★ | 📝 Надо |
| Calls UI ★ | 📝 Надо |
| PWA ★ | 📝 Надо |
| Push notifications ★ | 📝 Надо |
| Skeleton screens | 📝 Надо |
| Mobile responsive | 📝 Надо |
| i18n | ❌ Отложено |
