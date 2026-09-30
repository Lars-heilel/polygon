import { CLIENT_ROUTES } from '@org/common';
import { Button, StatusScreen } from '@org/shared';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title: string;
  let description: string;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} — ${error.statusText || 'Error'}`;
    description = String(error.data) || 'Something went wrong';
  } else if (error instanceof Error) {
    title = 'Something went wrong';
    description = error.message;
  } else {
    title = 'Something went wrong';
    description = 'An unexpected error occurred';
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <StatusScreen
        variant="error"
        title={title}
        description={description}
      >
        <Button onClick={() => navigate(CLIENT_ROUTES.root)}>Go to home</Button>
      </StatusScreen>
    </div>
  );
}
