import { ResetPasswordForm, useResetPassword } from '@org/features';
import { AuthLayout, toast } from '@org/shared';

export function ResetPasswordPage() {
  const { resetPassword } = useResetPassword();

  return (
    <AuthLayout
      title="New password"
      description="Choose a strong password"
    >
      <ResetPasswordForm
        onSubmit={async ({ token, password }) => {
          try {
            await resetPassword(token, password);
          } catch {
            toast.error('Failed to reset password. The link may have expired.');
          }
        }}
      />
    </AuthLayout>
  );
}
