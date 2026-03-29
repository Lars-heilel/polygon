import { type ReactNode } from 'react';
import { cn } from '../../lib/utils/cn';

interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      ReactNode;
  className?:   string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 px-4 text-center', className)}>
      {icon && (
        <span className="text-text-muted text-4xl">{icon}</span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {description && (
          <p className="text-xs text-text-muted max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
