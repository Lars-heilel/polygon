import { LoginForm, useLogin } from '@org/features-auth';
import { AuthLayout } from '@org/layouts-auth';

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
