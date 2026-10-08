import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackButton from './BackButton.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';

// Polyfill localStorage in test environment
const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof window !== 'undefined' && (!window.localStorage || typeof window.localStorage.getItem !== 'function')) {
  window.localStorage = createStorageMock();
}
if (typeof globalThis !== 'undefined' && (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function')) {
  globalThis.localStorage = createStorageMock();
}

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BackButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.history, 'state', {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  it('renders as icon-only with accessible aria-label, title, and touch target >= 44px', () => {
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toBe('Back to home');
    expect(button.getAttribute('title')).toBe('Back to home');
    expect(button.className).toContain('min-h-[44px]');
    expect(button.className).toContain('min-w-[44px]');

    // Strictly icon-only: No visible text element
    expect(screen.queryByText(/^back$/i)).toBeNull();
  });

  it('navigates to fallback ("/") when no in-app history exists', () => {
    Object.defineProperty(window.history, 'state', {
      value: null,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <BackButton fallback="/" />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to fallback ("/") when history.state.idx is 0', () => {
    Object.defineProperty(window.history, 'state', {
      value: { idx: 0 },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <BackButton fallback="/" />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('calls navigate(-1) when in-app history exists (idx > 0)', () => {
    Object.defineProperty(window.history, 'state', {
      value: { idx: 3 },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <BackButton fallback="/" />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders BackButton on Login page', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <Login />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    expect(button).toBeDefined();
    expect(screen.queryByText(/^back$/i)).toBeNull();
  });

  it('renders BackButton on Register page', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <Register />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /back to home/i });
    expect(button).toBeDefined();
    expect(screen.queryByText(/^back$/i)).toBeNull();
  });
});
