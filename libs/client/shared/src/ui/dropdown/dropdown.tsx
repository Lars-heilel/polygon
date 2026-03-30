import { useState, useRef, useEffect, type ReactNode, type MouseEvent } from 'react';
import { cn } from '../../lib/utils/cn';
import { Divider } from '../divider';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'left', className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleTriggerClick = (e: MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (onClick?: () => void) => {
    onClick?.();
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block text-left', className)} ref={menuRef}>
      <div onClick={handleTriggerClick}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 w-48 rounded-md bg-surface-elevated shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="py-1">
            {items.map((item, index) =>
              item.id === 'divider' ? (
                <Divider key={index} />
              ) : (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.onClick)}
                  className={cn(
                    'group flex w-full items-center gap-2 px-4 py-2 text-sm',
                    item.danger
                      ? 'text-danger hover:bg-danger/10'
                      : 'text-text hover:bg-surface'
                  )}
                >
                  {item.icon && (
                    <span className="text-text-muted group-hover:text-text">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
