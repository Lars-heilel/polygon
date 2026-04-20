import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { cn } from '../../lib/utils/cn';
import { Divider } from '../divider';

interface DropdownContextValue {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown subcomponents must be used within <Dropdown>');
  return ctx;
}

function DropdownTrigger({ children }: { children: ReactNode }) {
  const { isOpen, onOpenChange } = useDropdownContext();
  return (
    <div onClick={(e) => { e.stopPropagation(); onOpenChange(!isOpen); }}>
      {children}
    </div>
  );
}

interface DropdownMenuProps {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

function DropdownMenu({ children, align = 'left', className }: DropdownMenuProps) {
  const { isOpen } = useDropdownContext();

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 w-48 rounded-md bg-surface-elevated shadow-lg ring-1 ring-black ring-opacity-5',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function DropdownItem({ children, icon, danger, disabled, onClick }: DropdownItemProps) {
  const { onOpenChange } = useDropdownContext();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    onOpenChange(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-2 px-4 py-2 text-sm disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'text-text hover:bg-surface',
      )}
    >
      {icon && <span className="text-text-muted group-hover:text-text">{icon}</span>}
      {children}
    </button>
  );
}

function DropdownDivider() {
  return <Divider />;
}

interface DropdownProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

function DropdownRoot({ isOpen, onOpenChange, children, className }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <DropdownContext.Provider value={{ isOpen, onOpenChange }}>
      <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Divider: DropdownDivider,
});
