import { cn } from '../../lib/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        checked ? 'bg-primary' : 'bg-surface-elevated',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
