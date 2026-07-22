import type { ChangeEvent, ReactNode } from 'react';

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

export function Text({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)}
    />
  );
}

export function useTheme() {
  return {
    theme: 'dark',
    toggleTheme: jest.fn(),
  };
}
