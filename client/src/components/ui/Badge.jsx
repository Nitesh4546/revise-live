
const statusStyles = {
  neutral: 'bg-bg-subtle text-text-muted border-border',
  accent: 'bg-accent/10 text-accent border-accent/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
};

export default function Badge({
  children,
  variant = 'neutral',
  className = '',
  ...props
}) {
  const chosenStyle = statusStyles[variant] || statusStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-sm,4px)] text-xs font-semibold border ${chosenStyle} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
