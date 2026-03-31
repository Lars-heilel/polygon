import { LoginForm, useLogin } from '@org/features';
import { AuthLayout } from '@org/shared';

export function LoginPage() {
  const { login } = useLogin();

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account"
    >
      <LoginForm onSubmit={login} />
    </AuthLayout>
  );
}
