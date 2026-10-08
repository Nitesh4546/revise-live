
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-border rounded-[var(--radius-md,8px)] bg-bg-subtle/50 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-[var(--radius-md,8px)] bg-surface border border-border flex items-center justify-center text-text-muted mb-4 shadow-xs">
          <Icon className="w-6 h-6 stroke-[1.5]" aria-hidden="true" />
        </div>
      )}
      {title && (
        <h3 className="text-base sm:text-lg font-semibold text-text tracking-tight mb-1">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-xs sm:text-sm text-text-muted max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
