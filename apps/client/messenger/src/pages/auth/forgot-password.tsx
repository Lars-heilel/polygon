import { AuthLayout, toast } from '@org/shared';
import { ForgotPasswordForm, useForgotPassword } from '@org/features';

export function ForgotPasswordPage() {
  const { forgotPassword } = useForgotPassword();

  return (
    <AuthLayout
      title="Reset password"
      description="Enter your email and we'll send you a reset link"
    >
      <ForgotPasswordForm
        onSubmit={async (values) => {
          try {
            await forgotPassword(values.email);
          } catch {
            toast.error('Failed to send reset link. Please try again.');
          }
        }}
      />
    </AuthLayout>
  );
}
