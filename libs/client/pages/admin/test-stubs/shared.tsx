import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Heading({
  as,
  children,
}: {
  level?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: ReactNode;
}) {
  const Component = as ?? 'h2';

  return <Component>{children}</Component>;
}

export function Text({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return <div role="status">{label}</div>;
}

export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
}) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}

export function Button({
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: string;
}) {
  return (
    <button disabled={props.disabled || loading} {...props}>
      {children}
    </button>
  );
}
