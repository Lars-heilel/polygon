export {
  useSessionStore,
  selectIsAuthenticated,
  selectIsSessionLoading,
} from './lib/session/session.store';

export type { User } from './lib/user/user.api';
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
} from './lib/user/user.api';

export type { Chat, ChatMember, MemberProfile } from './lib/chat';
export {
  chatApi,
  useGetChatsQuery,
  useGetChatsSuspenseQuery,
  useCreateDirectChatMutation,
  useChatStore,
  selectActiveChatId,
  selectActiveMessageId,
  selectIsTyping,
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

export { useSearchUsersQuery, searchApi } from './lib/search/search.api';
export { initSocketMiddleware } from './lib/session/socket-middleware';
