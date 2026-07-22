import { type TextareaHTMLAttributes, forwardRef } from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const textareaVariants = cva(
  [
    'w-full resize-none rounded-md border bg-surface text-text placeholder:text-text-muted',
    'font-sans transition-colors outline-none',
    'focus:border-primary focus:ring-2 focus:ring-primary/30',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-2.5 text-base',
      },
      state: {
        default: 'border-border',
        error: 'border-danger focus:border-danger focus:ring-danger/30',
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
