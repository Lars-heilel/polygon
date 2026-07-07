import type { Chat } from './chat.api';

export function getChatDisplayName(chat: Pick<Chat, 'name' | 'members'>, myId: string): string {
  const isSelfChat = chat.members.length === 1 && chat.members[0]?.userId === myId;
  if (isSelfChat) {
    return chat.name ?? 'Личное';
  }

  const otherMember = chat.members.find((m) => m.userId !== myId) ?? chat.members[0];
  const p = otherMember?.profile;
  return p?.displayName ?? p?.name ?? chat.name ?? 'Chat';
}
