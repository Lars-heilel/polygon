import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'bg-surface-elevated border border-border text-text text-sm rounded-lg shadow-lg',
          title: 'font-medium',
          description: 'text-text-muted text-xs',
          success: 'border-l-4 border-l-green-500',
          error: 'border-l-4 border-l-danger',
          warning: 'border-l-4 border-l-yellow-400',
          info: 'border-l-4 border-l-primary',
          actionButton: 'bg-primary text-white text-xs px-2 py-1 rounded',
          closeButton: 'text-text-muted hover:text-text',
        },
      }}
    />
  );
}
