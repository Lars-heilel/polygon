import { useNavigate } from 'react-router';
import { AuthLayout, toast } from '@org/shared';
import { RegisterForm } from '@org/features';
import { CLIENT_ROUTES } from '@org/common';
import { useRegisterMutation } from '../app/store/auth-api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [register] = useRegisterMutation();

  return (
    <AuthLayout title="Create account" description="Get started for free">
      <RegisterForm
        onSubmit={async ({ confirmPassword: _, ...values }) => {
          try {
            await register(values).unwrap();
            navigate(CLIENT_ROUTES.chats.root);
          } catch {
            toast.error('Registration failed. Please try again.');
          }
        }}
      />
    </AuthLayout>
  );
}
