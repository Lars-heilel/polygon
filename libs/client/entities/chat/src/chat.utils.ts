import type { Chat } from './chat.api';

export function getChatDisplayName(chat: Pick<Chat, 'type' | 'name' | 'members'>, myId: string): string {
  if ((chat.type === 'GROUP' || chat.type === 'CHANNEL') && chat.name) {
    return chat.name;
  }

  const isSelfChat = chat.members.length === 1 && chat.members[0]?.userId === myId;
  if (isSelfChat) {
    return chat.name ?? 'Личное';
  }

  const otherMember = chat.members.find((m) => m.userId !== myId) ?? chat.members[0];
  const p = otherMember?.profile;
  return p?.displayName ?? p?.name ?? chat.name ?? 'Chat';
}
