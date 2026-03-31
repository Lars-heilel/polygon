import { type TextareaHTMLAttributes, forwardRef } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const textareaVariants = cva(
  'w-full bg-surface-elevated border rounded-md font-sans text-text placeholder:text-text-muted transition-colors outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed resize-none',
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

interface TextareaProps
  extends
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    Pick<VariantProps<typeof textareaVariants>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  maxChars?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ size, label, error, hint, maxChars, className, id, value, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const state = error ? 'error' : 'default';
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-text"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          className={cn(textareaVariants({ size, state }), className)}
          {...props}
        />
        {(error || hint || maxChars) && (
          <div className="flex justify-between">
            <p className={cn('text-xs', error ? 'text-danger' : 'text-text-muted')}>
              {error ?? hint}
            </p>
            {maxChars && (
              <p
                className={cn('text-xs', charCount > maxChars ? 'text-danger' : 'text-text-muted')}
              >
                {charCount}/{maxChars}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
