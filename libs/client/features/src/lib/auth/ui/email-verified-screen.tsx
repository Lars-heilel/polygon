import { CLIENT_ROUTES } from '@org/common';
import { Button, StatusScreen } from '@org/shared';
import { useNavigate } from 'react-router';

export function EmailVerifiedScreen() {
  const navigate = useNavigate();

  return (
    <StatusScreen
      variant="success"
      title="Email verified"
      description="Your account is now active. You can sign in."
    >
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(CLIENT_ROUTES.auth.login)}
      >
        Sign in
      </Button>
    </StatusScreen>
  );
}
