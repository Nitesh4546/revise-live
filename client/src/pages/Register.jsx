import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BackButton from '../components/BackButton.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/host');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-subtle text-text flex flex-col justify-center items-center px-4 py-12 relative transition-colors">
      {/* Top Controls */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <BackButton fallback="/" />
      </div>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[420px]">
        {/* Card Header & Wordmark */}
        <div className="text-center mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-[var(--radius-sm,4px)]"
            aria-label="ReviseLive Home"
          >
            <svg
              className="w-7 h-7 text-accent shrink-0"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="6" fill="var(--accent)" />
              <rect x="7" y="7" width="18" height="18" stroke="var(--accent-text)" strokeWidth="2" />
              <path d="M11 12h10M11 16h10M11 20h6" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-xl font-semibold tracking-tight text-text">ReviseLive</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text">
            Create teacher account
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Build diagnostic quizzes and identify student misconceptions
          </p>
        </div>

        {/* Centered Card */}
        <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
          {error && (
            <div
              role="alert"
              className="mb-5 p-3 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] flex items-start gap-2.5 text-danger text-xs sm:text-sm font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              id="register-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Eleanor Vance"
              autoComplete="name"
            />

            <Input
              label="Email address"
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Password"
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                helperText="Must be at least 8 characters long"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-8 text-text-muted hover:text-text cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus p-1 rounded-[var(--radius-sm,4px)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-border/70 text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-accent hover:underline font-semibold"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
