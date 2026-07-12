import { type InputHTMLAttributes, type ReactNode, forwardRef, useState } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const inputVariants = cva(
  'w-full bg-surface-elevated border rounded-md font-sans text-text placeholder:text-text-muted transition-colors outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-3 py-2',
        lg: 'text-base px-4 py-2.5',
      },
      state: {
        default: 'border-border',
        error: 'border-danger focus:ring-danger/40 focus:border-danger',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  },
);

interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    Pick<VariantProps<typeof inputVariants>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  revealable?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      revealable,
      className,
      id,
      type,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const state = error ? 'error' : 'default';
    const canReveal = revealable && type === 'password';
    const inputType = canReveal && isRevealed ? 'text' : type;
    const hasRightControl = !!rightIcon || canReveal;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputVariants({ size, state }),
              leftIcon && 'pl-9',
              hasRightControl && 'pr-9',
              className,
            )}
            type={inputType}
            disabled={disabled}
            {...props}
          />
          {canReveal ? (
            <button
              type="button"
              aria-label={isRevealed ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text focus:outline-none focus:text-text disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={() => setIsRevealed((value) => !value)}
            >
              {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          ) : rightIcon ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {rightIcon}
            </span>
          ) : null}
        </div>
        {(error || hint) && (
          <p className={cn('text-xs', error ? 'text-danger' : 'text-text-muted')}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
      <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a17.8 17.8 0 0 1-3.2 4.5" />
      <path d="M6.1 6.1C3.5 7.8 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.1-.9" />
    </svg>
  );
}
