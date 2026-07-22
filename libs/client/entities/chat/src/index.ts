export type { Chat, ChatMember, MemberProfile, Message as ChatMessage } from './chat.api';
export {
  chatApi,
  useGetChatsQuery,
  useGetChatsSuspenseQuery,
  useCreateDirectChatMutation,
  useCreateSelfChatMutation,
} from './chat.api';

export {
  useChatStore,
  selectActiveChatId,
  selectActiveMessageId,
  selectIsUserTyping,
  selectAnyTypingInChat,
  selectLastReceivedMessage,
  selectUnreadByChatId,
} from './chat.store';

export type { ChatItemProps } from './ui/chat-item';
export { ChatItem } from './ui/chat-item';

export { getChatDisplayName } from './chat.utils';
export { getMessagePreview } from './chat-preview';

export { usePresenceStore } from './presence.store';

export { ChatItemSkeleton } from './ui/chat-item-skeleton';

export { useChatList } from './use-chat-list';

export { MediaPanel } from './ui/media-panel';
export { useChatMediaInfiniteQuery, groupMediaByDate } from './api/use-chat-media';
export type { MediaFile } from './api/chat-media.api';
