import { AuthLayout } from '@org/shared';
import { LoginForm, useLogin } from '@org/features';

export function LoginPage() {
  const { login } = useLogin();

  return (
    <AuthLayout title="Welcome back" description="Sign in to your account">
      <LoginForm onSubmit={login} />
    </AuthLayout>
  );
}
