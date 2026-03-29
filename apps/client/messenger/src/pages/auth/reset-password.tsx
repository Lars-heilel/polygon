import { AuthLayout, toast } from '@org/shared';
import { ResetPasswordForm } from '@org/features';

export function ResetPasswordPage() {
  return (
    <AuthLayout title="New password" description="Choose a strong password">
      <ResetPasswordForm
        onSubmit={async (_values) => {
          try {
            // TODO: add reset-password endpoint to backend
            toast.success('Password updated successfully');
          } catch {
            toast.error('Failed to reset password. The link may have expired.');
          }
        }}
      />
    </AuthLayout>
  );
}
