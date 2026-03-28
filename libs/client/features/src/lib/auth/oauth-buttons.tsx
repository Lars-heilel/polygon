const API_BASE = import.meta.env['VITE_API_URL'] ?? '/api';

const PROVIDERS = [
  {
    id: 'github',
    label: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
      </svg>
    ),
  },
  {
    id: 'yandex',
    label: 'Yandex',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
        <path d="M2.04 12c0-5.523 4.476-10 9.999-10C17.522 2 22 6.477 22 12s-4.478 10-9.961 10C6.516 22 2.04 17.523 2.04 12Zm11.05 4.885V12.66h1.123l2.199 4.225h1.783l-2.42-4.53c1.24-.44 2.02-1.445 2.02-2.87 0-2.02-1.383-3.11-3.802-3.11H11.37v10.51h1.72Zm0-9.07h1.003c1.363 0 2.1.6 2.1 1.74 0 1.16-.757 1.8-2.12 1.8h-.983V7.815Z" />
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
      </svg>
    ),
  },
] as const;

export function OAuthButtons() {
  const handleOAuth = (provider: string) => {
    window.location.href = `${API_BASE}/auth/${provider}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleOAuth(id)}
          className="inline-flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-border"
        >
          {icon}
          Continue with {label}
        </button>
      ))}
    </div>
  );
}
