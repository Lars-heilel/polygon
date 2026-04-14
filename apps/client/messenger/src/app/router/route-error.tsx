import { Button, StatusScreen } from '@org/shared';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();

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
        <Button onClick={() => window.location.assign('/')}>Go to home</Button>
      </StatusScreen>
    </div>
  );
}
