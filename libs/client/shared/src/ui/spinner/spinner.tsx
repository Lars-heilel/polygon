import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      xl: 'w-8 h-8',
    },
    color: {
      current: 'text-current',
      primary: 'text-primary',
      muted: 'text-text-muted',
      white: 'text-white',
    },
  },
  defaultVariants: {
    size: 'md',
    color: 'current',
  },
});

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
  label?: string;
}

export function Spinner({ size, color, className, label = 'Loading...' }: SpinnerProps) {
  return (
    <svg
      className={cn(spinnerVariants({ size, color }), className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
