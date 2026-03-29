import { AuthLayout } from '@org/shared';
import { RegisterForm, useRegister } from '@org/features';

export function RegisterPage() {
  const { register } = useRegister();

  return (
    <AuthLayout title="Create account" description="Get started for free">
      <RegisterForm
        onSubmit={({ confirmPassword: _, ...values }) => register(values)}
      />
    </AuthLayout>
  );
}
