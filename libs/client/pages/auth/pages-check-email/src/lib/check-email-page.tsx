import { CheckEmailScreen } from '@org/features-auth';
import { useSearchParams } from 'react-router';

export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';

  return (
    <div className="flex min-h-screen items-center justify-center">
      <CheckEmailScreen email={email} />
    </div>
  );
}
