import { useTheme } from '@org/shared';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="bg-surface-elevated border border-border text-text px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-border"
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
