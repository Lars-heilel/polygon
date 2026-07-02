import { useSessionStore } from '@org/entities-user';
import { usePushSubscription } from '@org/features-notifications';

export function PushNotificationBootstrapper() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  usePushSubscription(isAuthenticated);
  return null;
}
