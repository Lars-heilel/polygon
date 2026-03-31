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
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
} from './lib/user/user.api';

export type { Chat, ChatMember, Message } from './lib/chat';
export {
  useGetChatsQuery,
  useCreateDirectChatMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useChatStore,
  selectActiveChatId,
  selectActiveMessageId,
  selectIsTyping,
} from './lib/chat';
