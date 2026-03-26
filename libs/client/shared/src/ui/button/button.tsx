import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from '../spinner/spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:   'bg-primary hover:bg-primary-hover text-white',
        secondary: 'bg-surface-elevated hover:bg-border text-text border border-border',
        ghost:     'text-text-muted hover:text-text hover:bg-surface-elevated',
        danger:    'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-5 py-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
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
