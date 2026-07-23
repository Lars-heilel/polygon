type MessagePreviewLike = {
  text: string | null;
  media: {
    category: string;
    fileName: string | null;
  } | null;
  attachments?: Array<{
    category: string;
    fileNameSnapshot: string | null;
  }> | null;
};

export function getMessagePreview(message: MessagePreviewLike | null | undefined): string {
  if (!message) {
    return 'Нет новых сообщений';
  }

  const text = message.text?.trim();
  if (text) {
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  const attachment = message.attachments?.[0] ?? null;
  const category = message.media?.category ?? attachment?.category;
  const fileName = message.media?.fileName ?? attachment?.fileNameSnapshot ?? null;

  switch (category) {
    case 'IMAGE':
      return '🖼 Фото';
    case 'VIDEO':
      return '🎬 Видео';
    case 'CIRCLE':
      return '⭕ Видеосообщение';
    case 'VOICE':
      return '🎤 Голосовое сообщение';
    case 'AUDIO':
      return '🎵 Аудиофайл';
    case 'FILE':
      return `📄 ${fileName ?? 'Файл'}`;
    default:
      return '📎 Вложение';
  }
}
