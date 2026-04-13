import { type ReactNode } from 'react';

import { RegisterForm, useRegister } from '@org/features';
import { AuthLayout } from '@org/layouts';

interface RegisterPageProps {
  oauthSlot?: ReactNode;
}

export function RegisterPage({ oauthSlot }: RegisterPageProps) {
  const { register, apiError } = useRegister();

  return (
    <AuthLayout
      title="Create account"
      description="Get started for free"
    >
      {oauthSlot}
      <RegisterForm
        onSubmit={({ confirmPassword: _, ...values }) => register(values)}
        apiError={apiError}
      />
    </AuthLayout>
  );
}
