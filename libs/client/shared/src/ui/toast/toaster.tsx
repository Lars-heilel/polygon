import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      gap={8}
      toastOptions={{
        classNames: {
          toast: [
            'group flex w-full items-start gap-3',
            'rounded-lg border border-border bg-surface text-text',
            'px-4 py-3 shadow-[var(--shadow-popover)]',
            '!font-sans',
          ].join(' '),
          title: 'text-sm font-semibold leading-snug text-text',
          description: 'mt-0.5 text-sm leading-relaxed text-text-muted',
          success: 'border-l-2 border-l-success',
          error: 'border-l-2 border-l-danger',
          warning: 'border-l-2 border-l-warning',
          info: 'border-l-2 border-l-info',
          closeButton: 'absolute right-2 top-2 text-text-muted transition-colors hover:text-text',
          actionButton: 'rounded-md bg-primary px-2.5 py-1 text-xs text-text-inverse',
        },
      }}
    />
  );
}
