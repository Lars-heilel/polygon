# Chat UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить бабблы, таймстампы, вьювер картинок, empty-state и кликабельность профиля без смены раскладки (все сообщения слева, mobile-first).

**Architecture:** Разбить `libs/client/shared/src/styles/global.css` на модули в `shared`, завести компонентные CSS (@layer components) для бабблов/медиа/вьювера, править только presentation (tokens + классы), логику группировки — в `virtual-message-list`.

**Tech Stack:** React + Vite, Tailwind v4 (@theme, @source), dayjs, embla-carousel, Nx packages (`@org/shared`, `@org/entities-message`, pages-chat-page).

**Spec:** Этот план + скриншоты в `docs/screenshots/app/` (12 шт) + открытое изображение `Снимок экрана_20260821_123513.png` (медиа-вьювер).

## Global Constraints

- Свои/чужие сообщения остаются слева (решение владельца, не менять на право).
- Mobile-first + адаптив: `max-w-[min(82vw,32rem)] sm:max-w-[70%]` сохранить как базу.
- Две темы: dark (default `@theme`) + `.theme-light` override — каждый новый цвет обязан иметь пару в обеих темах.
- Импорты только с корня слайсов (`@org/shared`, `@org/entities-message`), не из `src`-путей.
- Только npm (`npm exec nx -- ...`). pnpm/npx запрещены — ломают проект.
- Все новые UI-строки — на английском (empty-state, тултипы, статусы). Существующие русские строки (`печатает...`) унифицировать на английский.
- Actions сообщений: desctop — hover, touch — long-press.
- Частые коммиты, по одному на задачу.

---

### Task 1: Декомпозиция global.css на модули

**Files:**
- Create: `libs/client/shared/src/styles/theme.css` (тёмные `@theme`-токены + `.theme-light` рядом)
- Create: `libs/client/shared/src/styles/base.css`
- Create: `libs/client/shared/src/styles/animations.css`
- Create: `libs/client/shared/src/styles/vendor.css`
- Modify: `libs/client/shared/src/styles/global.css`
- Test: `libs/client/shared/src/styles/global-css-contract.spec.ts`

**Interfaces:**
- Consumes: текущий `global.css:1-186` (токены, base, keyframes, vendor).
- Produces: `global.css` как манифест из 4 `@import`, визуально ноль изменений.

- [ ] **Step 1: Прочитать контракт-тест чтобы не сломать токены**

```ts
// libs/client/shared/src/styles/global-css-contract.spec.ts — прочитать,
// выписать какие --color-*/--radius-*/--shadow-* ассертятся
```

Run: `npm exec nx -- test shared -- global-css-contract` (или `npm exec nx -- test @org/shared`)
Expected: PASS до рефактора (базовая линия)

- [ ] **Step 2: Вынести токены в tokens.css**

```css
/* tokens.css */
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";

@theme {
  --color-background: #101114;
  --color-surface: #17191d;
  /* ... скопировать все --color-*/--shadow-*/--radius-*/--font-* из global.css:5-41 дословно ... */
}
```

- [ ] **Step 3: Вынести светлую тему, базу, анимации, вендор**

```css
/* theme-light.css — дословно .theme-light блок из global.css:43-69 */
/* base.css — @layer base блок из global.css:97-136 */
/* animations.css — keyframes + @layer utilities из global.css:138-186 */
/* vendor.css — em-emoji-picker + .theme-light em-emoji-picker + [data-sonner-toaster] из global.css:71-95 */
```

- [ ] **Step 4: global.css как манифест**

```css
@import './tokens.css';
@import './theme-light.css';
@import './base.css';
@import './animations.css';
@import './vendor.css';
```

- [ ] **Step 5: Обновить контракт-тест под @import (читает global.css + все импортированные модули)**

```ts
// global-css-contract.spec.ts — вместо чтения одного global.css:
// собирает css = global.css + рекурсивно содержимое каждого `@import './x.css'`,
// ассерты токенов/запретов гоняет по собранной строке
```

- [ ] **Step 6: Прогнать тест + визуальная проверка обеих тем**

Run: `npm exec nx -- test shared -- global-css-contract`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/client/shared/src/styles/
git commit -m "refactor(shared): split global.css into tokens/theme/base/animations/vendor modules"
```

---

### Task 2: Таймстампы — короткий формат + группировка

**Files:**
- Modify: `libs/client/shared/src/lib/utils/date-format.ts:13-15`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Modify: `libs/client/entities/message/src/ui/message-bubble.tsx:75-83`
- Test: `libs/client/shared/src/lib/utils/` (новый `date-format.spec.ts`)

**Interfaces:**
- Consumes: `formatTime(date)`, `formatDate(date)` из `@org/shared`.
- Produces: `formatTime` → `HH:mm`; список передает `showAvatar/showTime` в `MessageBubble`.

- [ ] **Step 1: Написать падающий тест на короткий формат**

```ts
// date-format.spec.ts
import { formatTime } from './date-format';
test('formatTime returns HH:mm only', () => {
  expect(formatTime('2026-09-08T06:46:00')).toBe('06:46');
});
```

Run: `npm exec nx -- test shared -- date-format`
Expected: FAIL (`08.09.2026 06:46` вместо `06:46`)

- [ ] **Step 2: Починить formatTime (1 строка)**

```ts
export function formatTime(date: string | Date): string {
  return dayjs(date).format('HH:mm');
}
```

- [ ] **Step 3: Группировка в virtual-message-list — флаг показа аватара/времени**

```tsx
// предвычисленная мапа (renderItem не даёт соседей), ключ — senderId, порог 5 мин, симметрично к порядку:
const groupFlags = useMemo(() => {
  const map = new Map<string, { showAvatar: boolean; showTime: boolean; tight: boolean }>();
  const withinGap = (a: Message, b: Message) =>
    a.senderId === b.senderId && Math.abs(+new Date(a.createdAt) - +new Date(b.createdAt)) <= 5 * 60 * 1000;
  allMessages.forEach((msg, i) => {
    const prevGrouped = i > 0 && withinGap(allMessages[i - 1], msg);
    const nextGrouped = i < allMessages.length - 1 && withinGap(msg, allMessages[i + 1]);
    map.set(getMessageVirtualKey(msg), {
      showAvatar: !prevGrouped,
      showTime: !nextGrouped,
      tight: prevGrouped,
    });
  });
  return map;
}, [allMessages]);
// передать в <ChatMessageRow showAvatar/showTime/tight + в MessageBubble ...>
// actions: ⋯ скрыта до hover только на hover-устройствах ([@media(hover:hover)]:opacity-0 group-hover:opacity-100 + focus-within), на таче видна всегда; отдельного long-press нет — меню открывается тапом
```

- [ ] **Step 4: В MessageBubble рендерить аватар/время условно + скрыть ... до hover**

```tsx
{showAvatar ? <Avatar .../> : <span className="w-6 shrink-0" />}
{showTime && <span>{formatTime(displayCreatedAt)}</span>}
// actionsSlot обернуть: <span className="opacity-0 group-hover:opacity-100 ...">{actionsSlot}</span>
// на корневой div добавить `group`
```

- [ ] **Step 5: Проверить + коммит**

Run: `npm exec nx -- test shared && npm exec nx -- lint entities-message`
Expected: PASS

```bash
git add libs/client/shared/src/lib/utils/ libs/client/entities/message/ libs/client/pages/messenger/pages-chat-page/
git commit -m "fix(chat): short HH:mm timestamps with grouped avatars"
```

---

### Task 3: Бабблы — full-bleed медиа + варианты под типы

**Files:**
- Create: `libs/client/shared/src/styles/components/bubbles.css`
- Modify: `libs/client/shared/src/styles/global.css` (добавить `@import './components/bubbles.css'`)
- Modify: `libs/client/entities/message/src/ui/message-bubble.tsx:32-48`
- Modify: `libs/client/entities/message/src/ui/message-content.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx:77-90` (FileMessage ветка)

**Interfaces:**
- Consumes: `message.media?.category: IMAGE | VIDEO | AUDIO | VOICE | FILE`, `isMine`.
- Produces: CSS-классы `.msg-bubble`, `.msg-bubble--media`, `.msg-bubble--emoji-only`.

- [ ] **Step 1: Убрать responsive-переворот (баг строки 32)**

```tsx
// было: isMine ? 'flex-row-reverse lg:flex-row' : 'flex-row'  ← на десктопе свои уезжали влево-вправо
// стало (все слева по решению владельца):
<div className="group flex min-w-0 items-end gap-2 flex-row">
```

- [ ] **Step 2: Вариант без паддинга для медиа**

```tsx
const isMedia = !!message.media && ['IMAGE','VIDEO'].includes(message.media.category);
className={cn(
  'msg-bubble',
  isMedia ? 'msg-bubble--media p-0 overflow-hidden' : 'px-4 py-2.5',
  isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs',
)}
```

```css
/* bubbles.css */
@layer components {
  .msg-bubble { @apply min-w-0 max-w-[min(82vw,32rem)] text-sm sm:max-w-[70%] rounded-lg border shadow-[var(--shadow-surface)]; }
  .msg-bubble--mine { @apply border-primary bg-primary text-text-inverse rounded-br-sm; }
  .msg-bubble--theirs { @apply border-border bg-surface text-text rounded-bl-sm; }
  .msg-bubble--media img, .msg-bubble--media video { @apply block w-full h-auto object-cover; }
  .msg-bubble--emoji-only { @apply border-0 bg-transparent shadow-none text-3xl px-0; }
}
```

- [ ] **Step 3: LinkPreview — убрать дубль ссылки**

```tsx
// message-content.tsx: сырой <a> рендерить только если текст !== URL,
// карточке дать нейтральный фон: isMine ? 'bg-black/15' : 'bg-surface-elevated', title 1 строка
```

- [ ] **Step 4: Проверить руками (dark + light, mobile 360px + desktop)**

Run: `npm exec nx -- serve messenger` → открыть чат с фото/ссылкой/текстом
Expected: фото без синей рамки, ссылка без дубля `YouTube/YouTube`

- [ ] **Step 5: Commit**

```bash
git add libs/client/shared/src/styles/ libs/client/entities/message/
git commit -m "fix(chat): full-bleed media bubbles and link preview cleanup"
```

---

### Task 4: Аудио / войс / видео / файл бабблы

**Files:**
- Create: `libs/client/shared/src/styles/components/media-bubbles.css`
- Modify: `FileMessage` ветка в `virtual-message-list.tsx` + компонент `FileMessage` (entities-message)
- Modify: `libs/client/shared/src/ui/audio-player/global-audio-player.tsx` (стили, не логика)

**Interfaces:**
- Consumes: `AudioTrack[]`, `audioQueueIndexByMessageId`, `message.media`.
- Produces: `.voice-bubble`, `.audio-bubble`, `.video-bubble`, `.file-bubble` с парами dark/light.

- [ ] **Step 1: Войс — компактный ряд**

```tsx
<div className="voice-bubble">
  <button aria-label="Play voice" className="voice-bubble__btn">▶</button>
  <span className="voice-bubble__time">0:00</span>
  <div className="voice-bubble__wave" /> {/* существующий waveform, max-width 120px */}
  <span className="voice-bubble__time">0:05</span>
</div>
```

```css
@layer components {
  .voice-bubble { @apply flex items-center gap-2 rounded-md px-2 py-1.5; }
  .voice-bubble__btn { @apply grid size-8 place-items-center rounded-full bg-white/20 text-white hover:bg-white/30; }
}
```

- [ ] **Step 2: Видео — превью 16:9 с кнопкой play поверх, длительность badge**

```tsx
<div className="video-bubble"><video className="block w-full aspect-video object-cover" preload="metadata" /><span className="video-bubble__dur">0:05</span></div>
```

- [ ] **Step 3: Аудио-файл и документ — иконка + имя + размер + прогресс**

```tsx
<div className="file-bubble"><span className="file-bubble__icon">♫/📄 svg</span><span className="truncate">name.mp3</span><span className="text-xs opacity-70">3.2 MB</span></div>
```

- [ ] **Step 4: Контраст времени на синем: `text-white/85` вместо `text-text-inverse/70`**

- [ ] **Step 5: Commit**

```bash
git add libs/client/shared/src/ libs/client/entities/message/
git commit -m "fix(chat): redesign voice/audio/video/file bubbles"
```

---

### Task 5: Вьювер изображений (открытое изображение)

**Files:**
- Create: `libs/client/shared/src/styles/components/media-viewer.css`
- Modify: `libs/client/shared/src/ui/media-viewer/media-viewer.tsx:81-113,115`

**Interfaces:**
- Consumes: `MediaViewerItem[]`, `initialIndex`, `onClose`.
- Produces: минималистичный топ-бар: имя файла + счётчик + скачать + закрыть.

- [ ] **Step 1: Убрать двойной фон и карточку-хром**

```tsx
// было: bg-background/95 + absolute bg-black/70 + chrome rounded-md border bg-surface
// стало:
<div data-testid="media-viewer" className="media-viewer" onClick={onClose}>
  <div className="media-viewer__bar">
    <Text size="sm" className="truncate">{activeItem?.label ?? 'Media'}</Text>
    {items.length > 1 && <Text size="xs"> {selectedIndex+1} / {items.length}</Text>}
    <a href={activeItem?.src} download aria-label="Download">⤓ svg</a>
    <IconButton label="Close media viewer" ... icon={<span className="text-xl">×</span>} />
  </div>
  <div className="media-viewer__stage">...embla без p-2/p-6, img max-h-[82vh]...</div>
</div>
```

```css
@layer components {
  .media-viewer { @apply fixed inset-0 z-[70] flex flex-col bg-black/90 text-white; }
  .media-viewer__bar { @apply flex min-h-11 items-center gap-3 px-3 py-2; }
  .media-viewer__stage { @apply relative flex min-h-0 flex-1 items-center justify-center; }
}
```

- [ ] **Step 2: Escape/стрелки уже есть — добавить свайп-закрытие не надо, проверить `body overflow` cleanup**

- [ ] **Step 3: Проверить на мобиле (тап вне фото закрывает, видео controls работают)**

- [ ] **Step 4: Commit**

```bash
git add libs/client/shared/src/ui/media-viewer/ libs/client/shared/src/styles/
git commit -m "fix(media): minimal fullscreen image viewer without double backdrop"
```

---

### Task 6: Empty-state + кликабельность профиля + presence

**Files:**
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/chat-page.tsx` (ветка «no chat selected»)
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-header/chat-header.tsx:53-95`
- Create: `libs/client/shared/src/styles/components/chat-header.css`
- Modify: `libs/client/entities/chat/src/ui/chat-item.tsx` (дот присутствия)

**Interfaces:**
- Consumes: готовый `EmptyState` из `@org/shared`, `onlineUsers`, `typingUsers`.
- Produces: понятный affordance профиля + единый зеленый presence.

- [ ] **Step 1: Заменить голый `Select a chat` на EmptyState**

```tsx
import { EmptyState } from '@org/shared';
<EmptyState
  icon={<span aria-hidden="true">💬</span>}
  title="Select a chat"
  description="Choose a conversation from the list or start a new one."
/>
```

- [ ] **Step 2: Шапка — hover, chevron, тултип**

```tsx
<button
  onClick={() => setProfileUserId(otherUserId)}
  title="Open profile"
  className="chat-header-btn group"
>
  ...существующее...
  <span className="chat-header-btn__hint" aria-hidden="true">›</span> {/* или info-svg, opacity-0 group-hover:opacity-100 */}
</button>
```

```css
@layer components {
  .chat-header-btn { @apply flex flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-2; }
}
```

- [ ] **Step 3: Унифицировать presence: везде `variant="success"` зеленый дот, текст `Online` только в шапке; в списке убрать синюю точку-непрочитанное с аватара → бейдж справа**

- [ ] **Step 4: Локализация строк шапки (`Online`/`печатает...`) — завести в одном месте, не смешивать en/ru в одном экране**

- [ ] **Step 5: Commit**

```bash
git add libs/client/pages/messenger/ libs/client/entities/chat/ libs/client/shared/src/styles/
git commit -m "fix(chat): empty-state component and discoverable profile affordance"
```

---

### Task 7: Темизация и финальная полировка (dark + light)

**Files:**
- Modify: `libs/client/shared/src/styles/theme-light.css`
- Modify: `libs/client/shared/src/styles/components/*.css`
- Test: `libs/client/shared/src/styles/global-css-contract.spec.ts`

**Interfaces:**
- Consumes: все классы из задач 1-6.
- Produces: каждый новый токен/класс имеет пару dark/light, контраст времени на синем ≥ 4.5:1.

- [ ] **Step 1: Пройти каждый новый класс и добавить light-пару (bubble--mine текст/время, voice-btn, viewer-bar). База уже готова в Task 1: violet-палитра (dark primary #6757f2 ~5.2:1, light primary #4f3ed6 ~6.4:1, светлая без pure white)**

- [ ] **Step 2: Скриншоты dark + light (чат, войс, видео, вьювер, empty) в `docs/screenshots/app/`**

- [ ] **Step 3: Финальный прогон**

Run: `npm exec nx -- test shared && npm exec nx -- lint shared entities-message pages-chat-page`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(chat): theme-polished bubbles, viewer and empty states"
```
