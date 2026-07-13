import { CLIENT_ROUTES } from '@org/common';
import { Button, FormAlert, StatusScreen, Text } from '@org/shared';
import { Link } from 'react-router';

import { useResendVerification } from '../model/use-resend-verification';

interface CheckEmailScreenProps {
  email?: string;
}

const resendMessages = {
  success: 'Email sent — check your inbox.',
  error: 'Failed to send email. Please try again.',
  'rate-limited': 'Please wait before requesting another email.',
  idle: null,
} as const;

const resendVariants = {
  success: 'success',
  error: 'error',
  'rate-limited': 'error',
  idle: 'error',
} as const;

export function CheckEmailScreen({ email }: CheckEmailScreenProps) {
  const { resend, isPending, status } = useResendVerification();

  return (
    <StatusScreen
      variant="info"
      title="Check your email"
      description="We sent a verification link. Click the link to activate your account."
    >
      <FormAlert
        message={resendMessages[status]}
        variant={resendVariants[status]}
      />
      {email ? (
        <Button
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={() => resend(email)}
        >
          Resend email
        </Button>
      ) : null}
      <Text
        size="sm"
        color="muted"
      >
        <Link
          to={CLIENT_ROUTES.auth.login}
          className="hover:underline"
        >
          Back to sign in
        </Link>
      </Text>
    </StatusScreen>
  );
}
