import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-full shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        surface: 'bg-surface-elevated text-text border border-border',
        danger:  'bg-danger text-white',
        muted:   'bg-border text-text-muted',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5 min-w-[1.125rem]',
        md: 'text-xs    px-2   py-0.5 min-w-[1.375rem]',
      },
      dot: {
        true:  'w-2 h-2 p-0 min-w-0 rounded-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
      dot:     false,
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children?: ReactNode;
  className?: string;
}

export function Badge({ variant, size, dot, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, dot }), className)}>
      {!dot && children}
    </span>
  );
}
