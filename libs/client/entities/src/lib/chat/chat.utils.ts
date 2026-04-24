import type { Chat } from './chat.api';

export function getChatDisplayName(chat: Pick<Chat, 'name' | 'members'>, myId: string): string {
  const otherMember = chat.members.find((m) => m.userId !== myId);
  const p = otherMember?.profile;
  return p?.displayName ?? p?.name ?? chat.name ?? 'Chat';
}
