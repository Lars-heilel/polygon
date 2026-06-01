export {
  useSessionStore,
  selectIsAuthenticated,
  selectIsSessionLoading,
} from './model/session.store';

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

export { UserPanel } from './ui/user-panel';
export { ProfileModal } from './ui/profile-modal';
export { AuthBootstrap } from './ui/auth-provider';

export { useSearchUsers } from './api/use-search-users';
export { useSearchUsersQuery, searchApi } from './api/search.api';
