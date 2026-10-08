import { useTheme } from '../context/ThemeContext.jsx';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  let themeContext;
  try {
    themeContext = useTheme();
  } catch {
    themeContext = { theme: 'system', setTheme: () => {} };
  }
  const { theme, setTheme } = themeContext;

  return (
    <div
      role="group"
      aria-label="Theme preference"
      className={`inline-flex items-center rounded border border-border bg-surface p-0.5 text-text-muted shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-label="Light theme"
        title="Light theme"
        aria-pressed={theme === 'light'}
        className={`p-1.5 rounded transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
          theme === 'light'
            ? 'bg-accent text-accent-text'
            : 'text-text-muted hover:text-text hover:bg-surface-hover'
        }`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-label="Dark theme"
        title="Dark theme"
        aria-pressed={theme === 'dark'}
        className={`p-1.5 rounded transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-accent text-accent-text'
            : 'text-text-muted hover:text-text hover:bg-surface-hover'
        }`}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        aria-label="System theme"
        title="System theme"
        aria-pressed={theme === 'system'}
        className={`p-1.5 rounded transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
          theme === 'system'
            ? 'bg-accent text-accent-text'
            : 'text-text-muted hover:text-text hover:bg-surface-hover'
        }`}
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
}
