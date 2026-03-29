import { AuthLayout, toast } from '@org/shared';
import { ForgotPasswordForm } from '@org/features';

export function ForgotPasswordPage() {
  return (
    <AuthLayout title="Reset password" description="Enter your email and we'll send you a reset link">
      <ForgotPasswordForm
        onSubmit={async (_values) => {
          try {
            // TODO: add forgot-password endpoint to backend
            toast.success('Reset link sent — check your inbox');
          } catch {
            toast.error('Failed to send reset link. Please try again.');
          }
        }}
      />
    </AuthLayout>
  );
}
