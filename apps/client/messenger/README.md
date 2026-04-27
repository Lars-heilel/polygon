# Messenger

React 19 SPA — client application for the Polygon platform.

---

## Features Implemented

**Authentication**

- Registration and Login via email + password.
- OAuth — GitHub, Google, Yandex.
- Password reset and email confirmation (UI).
- Cookie-based sessions with automatic token refresh.

**Chats & Messaging**

- Sidebar chat list.
- Chat creation via user search.
- Message history.
- **Cursor pagination + Infinite scroll** (seamless history loading).
- Real-time message sending and receiving.
- **Emoji picker** (inserting emojis into messages).

**Notifications & API**

- **Browser Notification API**: pop-up notifications in the browser.
- **Sound Alerts**: audio signals for incoming messages.

**UI/UX**

- Dark / Light theme support.
- User Profile (modal window).
- Responsive design (Mobile/Desktop).
- Custom 404 page.

---

## Placeholders (UI exists, functionality pending)

| Page / Feature  | Status                     |
| --------------- | -------------------------- |
| Settings        | Empty placeholder screen   |
| Profile Editing | Modal without saving logic |
| Avatar          | System placeholder         |

---

## In Development

Full roadmap with implementation details — [`Todo.md`](../../Todo.md).

| #   | Feature                              | Complexity |
| --- | ------------------------------------ | ---------- |
| 1   | Markdown + Syntax highlighting       | 🟢         |
| 2   | Soft delete (messages/users)         | 🟢         |
| 3   | Edit and delete messages             | 🟢         |
| 4   | List virtualization (messages)       | 🟡         |
| 5   | User avatar (uploading)              | 🟡         |
| 6   | User blocking                        | 🟡         |
| 7   | Read status / Unread counters        | 🟡         |
| 8   | Files and images in chat             | 🟡         |
| 9   | Message reactions                    | 🟡         |
| 10  | Online status                        | 🔴         |
| 11  | Push notifications (Service Workers) | 🔴         |
| 12  | Group chats                          | 🔴         |
| 13  | 1-on-1 Voice calls (WebRTC)          | 🔴         |
| 14  | Friendship system                    | 🔴         |
| 15  | Group calls                          | 🔥         |

---

## Screenshots

### Desktop Version

| Light Mode                                                                         | Dark Mode                                                                                                          |
| :----------------------------------------------------------------------------------| :------------------------------------------------------------------------------------------------------------------|
| ![Light Mode](../../../docs/screenshots/Light-desktop.png)                         | ![Dark Mode](../../../docs/screenshots/ChatList%26ChatWindow.png)                                                  |
| Features:                                                                                                                                                                                               |
| Emoji picker for desktop                                                           | Markdown transformation and syntax highlighting. Wrap your text in triple backticks (```) to use.                  |
| ![Emoji-Desktop-Picker](../../../docs/screenshots/Desktop-emoji-feature.png)       | ![Text-to-Markdown](../../../docs/screenshots/MarkdownFeature.png)                                                 |
