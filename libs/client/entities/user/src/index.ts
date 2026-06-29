export {
  useSessionStore,
  selectIsAuthenticated,
  selectIsSessionLoading,
} from './model/session.store';

export type { SessionInfo } from './model/session.types';
export type { User } from './api/user.api';
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
} from './api/user.api';

export { AuthBootstrap } from './ui/auth-provider';

export { useSearchUsers } from './api/use-search-users';
export { useSearchUsersQuery, searchApi } from './api/search.api';
