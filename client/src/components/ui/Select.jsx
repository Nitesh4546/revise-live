import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    id,
    children,
    className = '',
    required = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold text-text tracking-wide flex items-center justify-between"
        >
          <span>{label}</span>
          {required && <span className="text-danger text-xs">*</span>}
        </label>
      )}
      <div className="relative w-full">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={`w-full h-10 pl-3 pr-9 py-2 bg-surface text-text border rounded-[var(--radius-sm,4px)] text-sm transition-colors appearance-none cursor-pointer focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:bg-bg-subtle disabled:cursor-not-allowed ${
            error ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <span id={errorId} className="text-xs text-danger font-medium">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="text-xs text-text-muted">
          {helperText}
        </span>
      ) : null}
    </div>
  );
});

export default Select;
