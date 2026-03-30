import { type ReactNode } from 'react';
import { cn } from '../../lib/utils/cn';

const variants = {
  error: { icon: '✕', color: 'text-danger' },
  success: { icon: '✓', color: 'text-green-500' },
  info: { icon: 'ℹ', color: 'text-primary' },
} as const;

interface StatusScreenProps {
  variant: keyof typeof variants;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function StatusScreen({
  variant,
  title,
  description,
  children,
  className,
}: StatusScreenProps) {
  const { icon, color } = variants[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-4 text-center',
        className
      )}
    >
      <span
        className={cn('text-5xl font-bold select-none', color)}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-text">{title}</p>
        {description && (
          <p className="text-sm text-text-muted max-w-sm">{description}</p>
        )}
      </div>
      {children && <div className="mt-2 flex gap-2">{children}</div>}
    </div>
  );
}
