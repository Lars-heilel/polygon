import type { ReactNode } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-full shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse',
        surface: 'border border-border bg-surface text-text',
        danger: 'bg-danger-muted text-danger',
        muted: 'bg-surface-muted text-text-muted',
        success: 'bg-success-muted text-success',
        warning: 'bg-warning-muted text-warning',
        info: 'bg-info-muted text-info',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5 min-w-[1.125rem]',
        md: 'text-xs    px-2   py-0.5 min-w-[1.375rem]',
      },
      dot: {
        true: 'w-2 h-2 p-0 min-w-0 rounded-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      dot: false,
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children?: ReactNode;
  className?: string;
}

export function Badge({ variant, size, dot, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, dot }), className)}>{!dot && children}</span>
  );
}
