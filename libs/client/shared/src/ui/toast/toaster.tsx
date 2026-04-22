import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      gap={8}
      toastOptions={{
        classNames: {
          toast: [
            'group flex items-start gap-3 w-full',
            'px-4 py-3 rounded-xl',
            'border border-border',
            'bg-surface-elevated/90 backdrop-blur-md',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]',
            '!font-sans',
          ].join(' '),
          title: 'font-semibold text-sm leading-snug text-primary',
          description: 'text-sm text-white mt-0.5 leading-relaxed',
          success: 'border-l-2 border-l-green-500',
          error:   'border-l-2 border-l-red-500',
          warning: 'border-l-2 border-l-yellow-400',
          info:    'border-l-2 border-l-primary',
          closeButton: 'absolute top-2 right-2 text-text-muted hover:text-text transition-colors',
          actionButton: 'bg-primary text-white text-xs px-2.5 py-1 rounded-lg',
        },
      }}
    />
  );
}
