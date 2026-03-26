import { type ReactNode } from 'react';

interface AuthLayoutProps {
  children:    ReactNode;
  title:       string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-surface flex">
      {/* Branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:flex-1 bg-surface-elevated border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary" />
          <span className="text-text font-semibold text-lg">Polygon</span>
        </div>
        <blockquote className="space-y-2">
          <p className="text-text text-xl font-medium leading-relaxed">
            "Fast, secure and always there when you need it."
          </p>
          <footer className="text-text-muted text-sm">Polygon Messenger</footer>
        </blockquote>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center items-center px-6 py-12 lg:px-16 lg:max-w-lg xl:max-w-xl">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo on mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary" />
            <span className="text-text font-semibold">Polygon</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            {description && (
              <p className="text-sm text-text-muted">{description}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
