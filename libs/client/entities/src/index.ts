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

export type { Chat, ChatMember, Message } from './lib/chat';
export {
  useGetChatsQuery,
  useGetChatsSuspenseQuery,
  useCreateDirectChatMutation,
  useGetMessagesQuery,
  useGetMessagesSuspenseQuery,
  useSendMessageMutation,
  useChatStore,
  selectActiveChatId,
  selectActiveMessageId,
  selectIsTyping,
} from './lib/chat';

export { useSearchUsersQuery, searchApi } from './lib/search/search.api';
