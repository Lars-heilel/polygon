import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';
import { Spinner } from '../spinner/spinner';

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-md',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-sm',
        md: 'h-9 w-9 text-base',
        lg: 'h-10 w-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  icon: ReactNode;
  label: string;
  loading?: boolean;
}

export function IconButton({
  icon,
  label,
  variant,
  size,
  loading = false,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
    </button>
  );
}
