import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';
import { Spinner } from '../spinner/spinner';

const buttonVariants = cva(
  [
    'inline-flex min-h-9 items-center justify-center gap-2 rounded-md',
    'font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-[var(--shadow-surface)]',
        secondary: 'border border-border bg-surface text-text hover:bg-surface-elevated',
        ghost: 'text-text-muted hover:bg-surface-elevated hover:text-text',
        danger: 'bg-danger text-text-inverse hover:opacity-90',
      },
      size: {
        sm: 'min-h-8 px-3 text-xs',
        md: 'min-h-9 px-4 text-sm',
        lg: 'min-h-10 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
