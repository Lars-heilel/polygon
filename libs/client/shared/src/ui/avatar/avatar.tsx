import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const avatarVariants = cva(
  'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-surface-elevated font-medium text-text select-none shrink-0',
  {
    variants: {
      size: {
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-56 h-56 text-xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

const statusDotVariants = cva('absolute bottom-0 right-0 rounded-full border-2 border-surface', {
  variants: {
    status: {
      online: 'bg-green-500',
      away: 'bg-yellow-400',
      offline: 'bg-gray-50',
    },
    size: {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2   h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3   h-3',
      xl: 'w-3.5 h-3.5',
    },
  },
});

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>['size']>;

interface AvatarProps {
  src?: string;
  name?: string;
  status?: 'online' | 'away' | 'offline';
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {src ? (
        <img
          src={src}
          alt={name ?? ''}
          className="w-full h-full object-cover"
        />
      ) : name ? (
        <span>{getInitials(name)}</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-1/2 h-1/2 opacity-40"
        >
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )}
      {status && <span className={cn(statusDotVariants({ status, size }))} />}
    </span>
  );
}
