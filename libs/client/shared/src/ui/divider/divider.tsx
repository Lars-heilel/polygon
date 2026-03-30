import { cn } from '../../lib/utils/cn';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
}

export function Divider({
  orientation = 'horizontal',
  label,
  className,
}: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={cn('w-px self-stretch bg-border', className)} />;
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return <hr className={cn('border-none h-px bg-border w-full', className)} />;
}
