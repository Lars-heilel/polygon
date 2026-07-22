import { frontendLog } from '@org/shared';

const chatDiagnosticKeys = new Map<string, string>();
let chatDiagnosticSequence = 0;
let lastSelectedChatKey: string | null = null;

export function getChatDiagnosticKey(chatId: string): string {
  const existingKey = chatDiagnosticKeys.get(chatId);
  if (existingKey) return existingKey;

  chatDiagnosticSequence += 1;
  const nextKey = `chat#${chatDiagnosticSequence}`;
  chatDiagnosticKeys.set(chatId, nextKey);
  return nextKey;
}

export function logChatSelected(chatId: string): string {
  const chatKey = getChatDiagnosticKey(chatId);
  const previousChatKey = lastSelectedChatKey;
  lastSelectedChatKey = chatKey;

  frontendLog('debug', 'ChatSwitch', 'chat_selected', {
    hasChatId: true,
    chatKey,
    previousChatKey,
    changed: previousChatKey !== chatKey,
  });

  return chatKey;
}

export function logChatViewUnmounted(chatKey: string): void {
  frontendLog('debug', 'ChatSwitch', 'chat_view_unmounted', {
    chatKey,
  });
}
