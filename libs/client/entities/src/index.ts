export {
  useSessionStore,
  selectIsAuthenticated,
  selectIsSessionLoading,
} from './lib/user/model/session.store';

export type { User } from './lib/user';
export {
  authApi,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
  useMeSuspenseQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  UserPanel,
  ProfileModal,
} from './lib/user';

export type { Chat, ChatMember, MemberProfile, ChatItemProps } from './lib/chat';
export {
  chatApi,
  useGetChatsQuery,
  useGetChatsSuspenseQuery,
  useCreateDirectChatMutation,
  useChatStore,
  selectActiveChatId,
  selectActiveMessageId,
  selectIsTyping,
  selectLastReceivedMessage,
  getChatDisplayName,
  ChatItem,
  ChatHeader,
  ChatHeaderSkeleton,
  ChatItemSkeleton,
} from './lib/chat';

export type { Message, MessagePage } from './lib/message';
export {
  messageApi,
  useInfiniteMessagesQuery,
  useSendMessageMutation,
  MessageBubble,
  MessageBubbleSkeleton,
  MessageListSkeleton,
} from './lib/message';
export { AuthBootstrap } from './lib/user/ui/auth-provider';
