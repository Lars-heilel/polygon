# Avatar System Refactoring Design

## Scope

Только бакет аватаров (`polygon-avatars`). Чат-файлы и другие категории НЕ ТРОГАЕМ.

---

## 1. Публичный бакет аватаров (MinIO)

### Текущее состояние
- MinIO: `polygon-avatars` bucket
- URL: presigned GET (TTL 7 дней) + presigned PUT для загрузки
- Доступ: только по presigned ссылкам

### Изменения

1. **Bucket policy** — сделать `polygon-avatars` публичным на чтение.
   - Добавить `setBucketPublic(bucket)` в `IStorageProvider`
   - Вызвать при инициализации для аватар-бакета
   - Policy: `{"Effect": "Allow", "Principal": "*", "Action": ["s3:GetObject"], "Resource": ["arn:aws:s3:::polygon-avatars/*"]}`

2. **Метод `getPublicUrl(bucket, key)`** — добавить в `IStorageProvider`:
   - Возвращает `const publicUrl = this.replaceEndpoint(\`${this.minioClient.protocol}//${this.minioClient.host}:${this.minioClient.port}/${bucket}/${key}\`)`
   - Фактически: `\`${publicEndpoint}/${bucket}/${key}\`` (используя `MINIO_PUBLIC_ENDPOINT`)

3. **Прямая загрузка (без presigned)**:
   - Добавить `putObject(bucket, key, buffer, mimeType): Promise<void>` в `IStorageProvider`
   - Использует `minioClient.putObject()` напрямую (без presigned)

4. **`getPresignedPutUrl`** и **`getPresignedUrl`** для аватаров больше не используются.

---

## 2. Загрузка аватара (Upload)

### Новый endpoint

```
POST /media/upload-avatar
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

**Тело:** `file` (бинарный файл изображения)

**Логика (gateway `media.controller.ts`):**
1. Принимает multipart файл (через `FileInterceptor`)
2. Валидация: MIME type (image/*), размер (через `UploadFileDto` или inline)
3. Генерирует ключ: `avatars/${userId}/${uuid}.${ext}` (единый формат с префиксом `avatars/`)
4. Загружает в MinIO: `storage.putObject(getAvatarsBucket(), key, buffer, mimeType)`
5. Конструирует публичный URL: `storage.getPublicUrl(getAvatarsBucket(), key)`
6. Вызывает media service (RabbitMQ `media.createFile`): создаёт запись в `File` со статусом `READY` и `url = publicUrl`
7. Вызывает user service (RabbitMQ `USER_PATTERNS.UPDATE`): обновляет `User.avatarUrl = publicUrl`
8. Возвращает `FileResponse`

**Новый паттерн в media service:** `media.createFile`
- Добавить в `MEDIA_PATTERNS` (в `libs/backend/core/src/constants/queues/media.queue.ts`): `CREATE_FILE: 'media.createFile'`
- Создаёт File record с переданными bucket, key, url, status=READY
- В `MediaService` добавляется метод `create(input: CreateFileInput): Promise<FileResponse>`
- В `MediaController` добавляется handler `@MessagePattern(MEDIA_PATTERNS.CREATE_FILE)`

### Обновление ключа аватаров

Текущий ключ: `${uploaderId}/${uuid}.${ext}` (без префикса `avatars/`)
Новый ключ: `avatars/${uploaderId}/${uuid}.${ext}` (единый префикс для всех аватаров)

Это не ломает обратную совместимость — старые файлы остаются в MinIO с их ключами.

---

## 3. Удаление аватара (Delete) — ИСПРАВЛЕНИЕ БАГА

### Текущий баг
При удалении активного аватара:
- Файл удалён из MinIO + File table
- `User.avatarUrl` НЕ обновляется (показывает битую ссылку)
- Фронтенд пытается чинить сам, но это ненадёжно (URL mismatch)

### Новое поведение

`DELETE /media/:id` — endpoint уже существует.

**Логика (gateway `media.controller.ts`):**
1-3. Существующая проверка (JWT, ownership, chat membership — без изменений)
4. Gateway получает `fileInfo` от media service (уже есть)
5. Если `fileInfo.category === 'AVATAR'`:
   - Gateway получает текущего пользователя: `userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub })`
   - Если `fileInfo.url === user.avatarUrl` (удаляемый файл — активный аватар):
     - Получает историю аватаров: `mediaClient.send('media.getHistory', { uploaderId: user.sub, category: 'AVATAR' })`
     - Находит предыдущий аватар (самый свежий по `createdAt`, исключая удаляемый)
     - `newAvatarUrl = previousAvatar?.url ?? null`
     - Вызывает `userClient.send(USER_PATTERNS.UPDATE, { id: user.sub, dto: { avatarUrl: newAvatarUrl } })`
6. Удаляет файл: `mediaClient.send('media.delete', { id })` (без изменений)
7. Возвращает `{ success: true, previousAvatarUrl: newAvatarUrl }`

**Важно:** Если предыдущий аватар тоже имеет presigned URL (был загружен до рефакторинга), он тоже может истечь. Но это временная проблема — все НОВЫЕ загрузки будут с постоянными URL.

### Ответ `DELETE /media/:id` расширяется:
```typescript
{
  success: boolean;
  previousAvatarUrl?: string | null; // только для AVATAR
}
```

---

## 4. История аватаров

`GET /media/history?category=AVATAR` — endpoint существует и не меняется.

Метод `getHistory()` в `MediaService` возвращает все файлы с публичными URL (теперь постоянными).

---

## 5. Отображение аватара

`<Avatar>` компонент (`avatar.tsx`) уже корректно обрабатывает:
- `src` = URL → показывает `<img>`
- `src` = null + `name` → показывает инициалы

Менять ничего не нужно.

---

## 6. Файлы для изменения

### MinIO Storage (`libs/backend/core/src/storage/`)

| Файл | Изменения |
|------|-----------|
| `storage-provider.interface.ts` | Добавить `getPublicUrl(bucket, key): string`, `putObject(bucket, key, buffer, mimeType): Promise<void>`, `setBucketPublic(bucket): Promise<void>` |
| `minio-storage.provider.ts` | Реализовать `getPublicUrl`, `putObject`, `setBucketPublic`. В `ensureBucket` для аватар-бакета вызывать `setBucketPublic`. |

### Media Service (`libs/backend/media/src/`)

| Файл | Изменения |
|------|-----------|
| `interfaces/media.interface.ts` | Добавить `create(input: CreateFileInput)` в `IMediaService`, `IMediaRepository`. Добавить `CreateFileInput` интерфейс. |
| `services/media.service.ts` | Добавить метод `create(input: CreateFileInput): Promise<FileResponse>`. `delete()` — без изменений. |
| `database/repository/media.prisma.repo.ts` | Добавить `create(data)`. Сейчас метод существует, проверить сигнатуру. |
| `controllers/media.controller.ts` | Добавить handler `media.createFile` для MessagePattern |

### Gateway (`apps/backend/gateway/src/controllers/`)

| Файл | Изменения |
|------|-----------|
| `media.controller.ts` | Добавить `POST /media/upload-avatar` (multipart, JWT guard). Модифицировать `DELETE /media/:id` — добавить логику обновления `User.avatarUrl` при удалении аватара. |

### User Service (`libs/backend/user/src/`)

Без изменений — `update()` уже существует.

### Frontend (`libs/client/features/upload-avatar/src/`)

| Файл | Изменения |
|------|-----------|
| `api/upload-avatar.api.ts` | Добавить `uploadAvatar(file: File): Promise<FileResponse>`. Остальные функции (`initUpload`, `uploadToMinio`, `confirmUpload`) не удалять — могут использоваться для других категорий файлов. |
| `hooks/use-avatar-upload.ts` | Переписать на `uploadAvatar` (вместо `initUpload → uploadToMinio → confirmUpload`). |
| `ui/avatar-carousel.tsx` | `handleDelete` — убрать ручное `updateUserProfile`, т.к. это делает бэкенд. |
| `ui/avatar-uploader.tsx` | Использовать новый `uploadAvatar`. |

---

## 7. Sequence Diagrams

### Upload

```
Frontend                Gateway               MinIO           Media Service         User Service
   |                       |                    |                  |                     |
   | POST /media/         |                    |                  |                     |
   | upload-avatar        |                    |                  |                     |
   | (multipart file)     |                    |                  |                     |
   |---------------------->|                   |                  |                     |
   |                       | putObject()       |                  |                     |
   |                       |------------------>|                  |                     |
   |                       | <-----------------|                  |                     |
   |                       |  MEDIA_PATTERNS   |                  |                     |
   |                       |  .CREATE_FILE     |                  |                     |
   |                       |------------------------------------->|                     |
   |                       | <-------------------------------------|                     |
   |                       |  USER_PATTERNS    |                  |                     |
   |                       |  .UPDATE          |                  |                     |
   |                       |-------------------------------------------------->|
   |                       | <--------------------------------------------------|
   |<----------------------|                   |                  |                     |
```

### Delete (active avatar)

```
Frontend              Gateway               Media Service      User Service
   |                     |                       |                   |
   | DELETE /media/:id   |                       |                   |
   |--------------------->|                      |                   |
   |                     | media.getById         |                   |
   |                     |---------------------->|                   |
   |                     |<----------------------|                   |
   |                     | (category = AVATAR)    |                   |
   |                     |                       |                   |
   |                     | USER_PATTERNS         |                   |
   |                     | .GET_BY_ID            |                   |
   |                     |------------------------------------------>|
   |                     |<------------------------------------------|
   |                     | (user.avatarUrl)       |                   |
   |                     |                       |                   |
   |                     | if file.url ==         |                   |
   |                     | user.avatarUrl:        |                   |
   |                     |  media.getHistory      |                   |
   |                     | (AVATAR)               |                   |
   |                     |---------------------->|                   |
   |                     |<----------------------|                   |
   |                     |  (find prev avatar)    |                   |
   |                     |                       |                   |
   |                     | USER_PATTERNS.UPDATE   |                   |
   |                     | {avatarUrl: url|null}  |                   |
   |                     |------------------------------------------>|
   |                     |<------------------------------------------|
   |                     |                       |                   |
   |                     | media.delete           |                   |
   |                     |---------------------->|                   |
   |                     |<----------------------|                   |
   |<--------------------|                       |                   |
```

---

## 8. Неизменный функционал

- `GET /media/history` — без изменений
- `POST /media/init-upload` — остаётся для не-аватар файлов
- `POST /media/confirm` — остаётся для не-аватар файлов
- `GET /media/files/:fileId/url` — остаётся для не-аватар файлов
- `GET /media/files/:fileId/content` — остаётся для не-аватар файлов
- `GET /chats/:chatId/media/history` — без изменений
- `GET /users/:userId/avatars` — без изменений
- `PATCH /users/me` — без изменений (может использоваться для других полей)
- `POST /media/init-upload` для аватаров — будет удалён (заменён на `POST /media/upload-avatar`)

---

## 9. Миграция данных

Старые аватары (с presigned URL) продолжают работать, пока не истекут их presigned ссылки (7 дней с момента загрузки). После рефакторинга:

- Новые загрузки получают постоянные публичные URL
- Старые файлы остаются в MinIO (ключи без префикса `avatars/`)
- При удалении аватара, если `User.avatarUrl` указывает на старую presigned ссылку — обновление на `null` или на новый постоянный URL сработает корректно

Миграция не требуется. Старые файлы физически доступны в MinIO по тому же ключу, только URL в БД — presigned (истекает через 7 дней).
