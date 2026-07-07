import type { Message as MessageBase } from '@org/common';

type Message = Omit<MessageBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export function getMessagePreview(message: Message | null | undefined): string {
  if (!message) {
    return 'Нет новых сообщений';
  }

  const text = message.text?.trim();
  if (text) {
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  switch (message.fileCategory) {
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
      return `📄 ${message.fileName ?? 'Файл'}`;
    default:
      return '📎 Вложение';
  }
}
