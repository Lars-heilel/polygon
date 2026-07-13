import { CLIENT_ROUTES } from '@org/common';
import { Button, StatusScreen } from '@org/shared';
import { useNavigate } from 'react-router';

export function EmailVerifiedScreen() {
  const navigate = useNavigate();

  return (
    <StatusScreen
      variant="success"
      title="Email verified"
      description="Your email is verified. You can continue to chats."
    >
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(CLIENT_ROUTES.chats.root)}
      >
        Continue to chats
      </Button>
    </StatusScreen>
  );
}
