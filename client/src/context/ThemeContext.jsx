import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { authApi } from '../api/authApi.js';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'reviselive:theme';

function getStoredTheme() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY);
    }
  } catch {}
  return null;
}

function setStoredTheme(val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, val);
    }
  } catch {}
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return getSystemTheme();
}

function applyThemeToDOM(resolved) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Temporarily disable transitions to prevent color flicker
  root.classList.add('theme-transitioning');

  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#1F1F1F' : '#FFFFFF');
  }

  // Remove transition lock after a tick
  setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 50);
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const syncedUserIdRef = useRef(null);

  const [theme, setThemeState] = useState(() => {
    const stored = getStoredTheme();
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(theme));

  // Sync with teacher account preferences on login/profile load (only when user identity changes)
  useEffect(() => {
    const currentId = user?._id || user?.id;
    if (user && currentId && currentId !== syncedUserIdRef.current) {
      syncedUserIdRef.current = currentId;
      if (user.preferences?.theme) {
        const serverTheme = user.preferences.theme;
        setThemeState(serverTheme);
        setStoredTheme(serverTheme);
        const resolved = resolveTheme(serverTheme);
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved);
      }
    } else if (!user) {
      syncedUserIdRef.current = null;
    }
  }, [user]);

  // Apply resolved theme to DOM
  const updateResolved = useCallback((pref) => {
    const resolved = resolveTheme(pref);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  }, []);

  // Listen to OS theme changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        updateResolved('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, updateResolved]);

  // Listen to storage events for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
          setThemeState(e.newValue);
          updateResolved(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [updateResolved]);

  // Apply on initial mount
  useEffect(() => {
    updateResolved(theme);
  }, [theme, updateResolved]);

  // Set theme handler
  const setTheme = useCallback(
    (newTheme) => {
      if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') return;

      setThemeState(newTheme);
      setStoredTheme(newTheme);
      updateResolved(newTheme);

      // Fire-and-forget persist to server if teacher is authenticated
      if (user) {
        if (user.preferences) {
          user.preferences.theme = newTheme;
        }
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            parsed.preferences = { ...parsed.preferences, theme: newTheme };
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {}
        authApi.updatePreferences({ theme: newTheme }).catch(() => {
          // Failure never blocks or flickers UI
        });
      }
    },
    [user, updateResolved]
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
