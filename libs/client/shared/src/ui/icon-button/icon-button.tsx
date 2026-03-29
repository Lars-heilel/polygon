import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils/cn';
import { Spinner } from '../spinner/spinner';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0',
  {
    variants: {
      variant: {
        primary:   'bg-primary hover:bg-primary-hover text-white',
        secondary: 'bg-surface-elevated hover:bg-border text-text border border-border',
        ghost:     'text-text-muted hover:text-text hover:bg-surface-elevated',
        danger:    'bg-danger text-white hover:opacity-90',
      },
      size: {
        xs: 'w-6  h-6  text-xs',
        sm: 'w-7  h-7  text-sm',
        md: 'w-9  h-9  text-base',
        lg: 'w-10 h-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size:    'md',
    },
  },
);

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon:       ReactNode;
  label:      string;
  loading?:   boolean;
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
