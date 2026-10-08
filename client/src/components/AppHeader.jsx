import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { Menu, MenuItem, MenuDivider } from './ui/Menu.jsx';
import { LogOut, User as UserIcon, Menu as HamburgerIcon, X } from 'lucide-react';

export default function AppHeader({ className = '' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { label: 'Quizzes', href: '/dashboard' },
    { label: 'History', href: '/history' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-xs border-b border-border transition-colors ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Geometric Wordmark & Desktop Nav */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-2.5 text-text hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-[var(--radius-sm,4px)]"
            aria-label="ReviseLive Home"
          >
            {/* Geometric Mark (Fluent Blue square with crisp geometric document lines) */}
            <svg
              className="w-7 h-7 shrink-0 text-accent"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="6" fill="var(--accent)" />
              <rect x="7" y="7" width="18" height="18" rx="2" stroke="var(--accent-text)" strokeWidth="2" />
              <path d="M11 12h10M11 16h10M11 20h6" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-base sm:text-lg text-text tracking-tight">
              ReviseLive
            </span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`px-3 py-1.5 text-sm font-medium rounded-[var(--radius-sm,4px)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      isActive
                        ? 'text-accent bg-accent/10 font-semibold'
                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right: Theme Toggle & User Menu */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="hidden sm:block">
              <Menu
                trigger={
                  <button
                    type="button"
                    className="h-9 px-3 inline-flex items-center gap-2 rounded-[var(--radius-sm,4px)] bg-surface hover:bg-surface-hover border border-border text-text text-xs sm:text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    aria-label={`User menu for ${user.name || user.email}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-xs shrink-0">
                      {(user.name || user.email || 'U')[0].toUpperCase()}
                    </span>
                    <span className="max-w-[120px] truncate">{user.name || 'Account'}</span>
                  </button>
                }
                align="right"
              >
                <div className="px-3.5 py-2 border-b border-border/60">
                  <p className="text-xs font-semibold text-text truncate">{user.name}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
                <MenuItem icon={UserIcon} onClick={() => navigate('/dashboard')}>
                  Dashboard
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={LogOut} destructive onClick={handleSignOut}>
                  Sign out
                </MenuItem>
              </Menu>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-text hover:bg-surface-hover border border-transparent rounded-[var(--radius-sm,4px)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-accent text-white hover:bg-accent-hover rounded-[var(--radius-sm,4px)] shadow-xs transition-colors"
              >
                Create account
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          {user && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden min-w-[44px] min-h-[44px] w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-sm,4px)] text-text hover:bg-surface-hover border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <HamburgerIcon className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-3 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
          <div className="pb-2 border-b border-border/60">
            <p className="text-xs font-semibold text-text">{user.name}</p>
            <p className="text-xs text-text-muted">{user.email}</p>
          </div>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 text-sm font-medium rounded-[var(--radius-sm,4px)] transition-colors ${
                  isActive
                    ? 'text-accent bg-accent/10 font-semibold'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              className="w-full text-left px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 rounded-[var(--radius-sm,4px)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
