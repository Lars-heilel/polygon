import { type ReactNode, memo, useState } from 'react';

import { Avatar, Badge, Heading, Text, cn } from '@org/shared';

interface ProfileHeaderProps {
  avatarUrl?: string | null;
  displayName: string;
  handleName: string;
  role?: string | null;
  bio?: string | null;
  email?: string | null;
  avatarBadge?: ReactNode;
  onAvatarClick?: () => void;
  actions?: ReactNode;
  className?: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
      className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
    >
      {copied ? (
        <svg aria-hidden="true" className="h-3.5 w-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export const ProfileHeader = memo(function ProfileHeader({
  avatarUrl,
  displayName,
  handleName,
  role,
  bio,
  email,
  avatarBadge,
  onAvatarClick,
  actions,
  className,
}: ProfileHeaderProps) {
  const avatar = (
    <span className="relative inline-block shrink-0">
      <Avatar
        src={avatarUrl ?? undefined}
        name={displayName}
        size="xl"
        className="ring-2 ring-border"
      />
      {avatarBadge}
    </span>
  );

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {onAvatarClick ? (
        <button
          type="button"
          aria-label="Open avatar history"
          onClick={onAvatarClick}
          className="shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 focus:outline-none"
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}

      <div className="text-center">
        <Heading level={5} as="h3" className="flex items-center justify-center gap-2">
          {displayName}
          {role === 'CREATOR' && <Badge variant="warning">Creator</Badge>}
        </Heading>
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted">
          @{handleName}
          <CopyButton value={`@${handleName}`} label="Copy username" />
        </span>
      </div>

      {bio && (
        <Text size="sm" className="max-w-xs break-words text-center">
          {bio}
        </Text>
      )}

      {email && (
        <div className="flex w-full max-w-xs items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{email}</span>
          <CopyButton value={email} label="Copy email" />
        </div>
      )}

      {actions}
    </div>
  );
});
