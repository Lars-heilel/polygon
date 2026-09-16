import { memo } from 'react';

interface UndecryptableMessageProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export const UndecryptableMessage = memo(function UndecryptableMessage({
  onRetry,
  isRetrying = false,
}: UndecryptableMessageProps) {
  return (
    <div
      data-testid="undecryptable-message"
      className="flex min-w-0 items-center gap-2"
    >
      <span className="min-w-0 flex-1 break-words text-[14px] italic opacity-70">
        Не удалось расшифровать
      </span>
      <button
        type="button"
        data-testid="undecryptable-retry"
        onClick={onRetry}
        disabled={isRetrying}
        className="shrink-0 text-[12px] font-medium underline underline-offset-2 disabled:opacity-50"
      >
        {isRetrying ? '…' : 'Повторить'}
      </button>
    </div>
  );
});
