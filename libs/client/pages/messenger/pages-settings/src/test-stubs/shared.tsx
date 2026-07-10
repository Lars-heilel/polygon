import type { ReactNode } from 'react';

export function Heading({
  as,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: ReactNode;
  level?: number;
}) {
  const Component = as ?? 'h2';

  return <Component>{children}</Component>;
}
