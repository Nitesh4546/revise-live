
const variantStyles = {
  primary:
    'bg-accent hover:bg-accent-hover active:bg-accent-pressed text-white shadow-sm border border-transparent',
  secondary:
    'bg-surface hover:bg-surface-hover active:bg-bg-subtle text-text border border-border shadow-xs',
  subtle:
    'bg-transparent hover:bg-surface-hover active:bg-bg-subtle text-text border border-transparent',
  destructive:
    'bg-danger hover:brightness-95 active:brightness-90 text-white shadow-sm border border-transparent',
  destructiveOutline:
    'bg-surface hover:bg-danger/10 text-danger border border-danger/30',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2.5',
  icon: 'h-10 w-10 p-0 inline-flex items-center justify-center',
};

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}) {
  const chosenVariant = variantStyles[variant] || variantStyles.secondary;
  const chosenSize = sizeStyles[size] || sizeStyles.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${chosenVariant} ${chosenSize} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
