import { RegisterForm, useRegister } from '@org/features';
import { AuthLayout } from '@org/shared';

export function RegisterPage() {
  const { register, apiError } = useRegister();

  return (
    <AuthLayout
      title="Create account"
      description="Get started for free"
    >
      <RegisterForm
        onSubmit={({ confirmPassword: _, ...values }) => register(values)}
        apiError={apiError}
      />
    </AuthLayout>
  );
}
