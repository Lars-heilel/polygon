import { Heading, Text } from '@org/shared';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-8xl font-bold text-purple-60 select-none">404</p>
      <Heading
        level={2}
        as="h1"
      >
        Page not found
      </Heading>
      <Text
        size="sm"
        color="muted"
        className="max-w-xs"
      >
        The page you're looking for doesn't exist or has been moved.
      </Text>
      <Link
        to="/"
        className="mt-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
