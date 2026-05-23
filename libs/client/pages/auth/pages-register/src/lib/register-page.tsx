import { OAuthButtons, RegisterForm, useRegister } from '@org/features-auth';
import { AuthLayout } from '@org/layouts-auth';

export function RegisterPage() {
  const { register, apiError } = useRegister();

  return (
    <AuthLayout
      title="Create account"
      description="Get started for free"
    >
      <OAuthButtons />
      <RegisterForm
        onSubmit={({ confirmPassword: _, ...values }) => register(values)}
        apiError={apiError}
      />
    </AuthLayout>
  );
}
