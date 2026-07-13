import { CheckEmailScreen } from '@org/features-auth';
import { useLocation } from 'react-router';

type CheckEmailLocationState = {
  email?: unknown;
};

export function CheckEmailPage() {
  const location = useLocation();
  const state = location.state as CheckEmailLocationState | null;
  const email = typeof state?.email === 'string' ? state.email : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <CheckEmailScreen email={email} />
    </div>
  );
}
