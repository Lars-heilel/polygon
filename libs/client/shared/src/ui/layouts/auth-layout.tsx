import { type ReactNode } from 'react';

import { Heading } from '../typography/heading';
import { Text } from '../typography/text';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className=" bg-surface-elevated border border-purple-60 rounded-xl p-7  ">
        <div className="mb-6">
          <Heading level={4}>{title}</Heading>
          {description && (
            <Text
              size="sm"
              color="muted"
              className="mt-1"
            >
              {description}
            </Text>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
