import { OAuthButtons, RegisterForm, useRegister } from '@org/features';
import { AuthLayout } from '@org/layouts';

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
