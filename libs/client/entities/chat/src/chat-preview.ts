type MessagePreviewLike = {
  text: string | null;
  media: {
    category: string;
    fileName: string | null;
  } | null;
};

export function getMessagePreview(message: MessagePreviewLike | null | undefined): string {
  if (!message) {
    return 'Нет новых сообщений';
  }

  const text = message.text?.trim();
  if (text) {
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  switch (message.media?.category) {
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
      return `📄 ${message.media.fileName ?? 'Файл'}`;
    default:
      return '📎 Вложение';
  }
}
