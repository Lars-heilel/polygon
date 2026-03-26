import { useNavigate } from 'react-router';
import { AuthLayout, toast } from '@org/shared';
import { LoginForm } from '@org/features';
import { CLIENT_ROUTES } from '@org/common';
import { useLoginMutation } from '../app/store/auth-api';

export function LoginPage() {
  const navigate = useNavigate();
  const [login] = useLoginMutation();

  return (
    <AuthLayout title="Welcome back" description="Sign in to your account">
      <LoginForm
        onSubmit={async (values) => {
          try {
            await login(values).unwrap();
            navigate(CLIENT_ROUTES.chats.root);
          } catch {
            toast.error('Invalid email or password');
          }
        }}
      />
    </AuthLayout>
  );
}
