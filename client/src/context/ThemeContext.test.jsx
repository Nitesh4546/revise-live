import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';
import * as AuthContextModule from './AuthContext';
import * as authApi from '../api/authApi';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/authApi', () => ({
  authApi: {
    updatePreferences: vi.fn().mockResolvedValue({ preferences: { theme: 'dark' } }),
  },
}));

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolvedTheme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
}

describe('ThemeContext and ThemeProvider', () => {
  let matchMediaListeners = [];
  let storage = {};

  const mockLocalStorage = {
    getItem: vi.fn((key) => storage[key] || null),
    setItem: vi.fn((key, val) => {
      storage[key] = String(val);
    }),
    removeItem: vi.fn((key) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      storage = {};
    }),
  };

  beforeEach(() => {
    storage = {};
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    matchMediaListeners = [];

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false, // light by default in mock
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        matchMediaListeners.push(handler);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    AuthContextModule.useAuth.mockReturnValue({ user: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to system theme when localStorage is empty and user has no preference', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('restores theme from localStorage on initial load', () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === 'reviselive:theme' ? 'dark' : null));

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists manual theme changes to localStorage and updates DOM', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    const darkBtn = screen.getByText('Set Dark');
    await act(async () => {
      darkBtn.click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('reviselive:theme', 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('syncs theme preference to server for authenticated users', async () => {
    const user = { id: 'u1', name: 'Teacher', preferences: { theme: 'system' } };
    AuthContextModule.useAuth.mockReturnValue({ user });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    const darkBtn = screen.getByText('Set Dark');
    await act(async () => {
      darkBtn.click();
    });

    expect(authApi.authApi.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('syncs across tabs on storage event', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'reviselive:theme',
          newValue: 'dark',
        })
      );
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolvedTheme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
