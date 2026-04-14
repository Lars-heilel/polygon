interface SidebarHeaderProps {
  onMenuClick?: () => void;
}

export function SidebarHeader({ onMenuClick }: SidebarHeaderProps) {
  return (
    <header className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="p-2 hover:bg-surface-elevated rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Polygon</h1>
      </div>
    </header>
  );
}
