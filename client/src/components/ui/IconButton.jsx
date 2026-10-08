
const variantStyles = {
  subtle: 'bg-transparent hover:bg-surface-hover active:bg-bg-subtle text-text border border-transparent',
  secondary: 'bg-surface hover:bg-surface-hover active:bg-bg-subtle text-text border border-border shadow-xs',
  primary: 'bg-accent hover:bg-accent-hover active:bg-accent-pressed text-white border border-transparent',
  destructive: 'bg-transparent hover:bg-danger/10 text-danger border border-transparent',
};

export default function IconButton({
  children,
  label,
  variant = 'subtle',
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const chosenVariant = variantStyles[variant] || variantStyles.subtle;

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`min-w-[44px] min-h-[44px] w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${chosenVariant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
