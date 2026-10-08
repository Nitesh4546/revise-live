import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    id,
    type = 'text',
    className = '',
    required = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-text tracking-wide flex items-center justify-between"
        >
          <span>{label}</span>
          {required && <span className="text-danger text-xs">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        className={`w-full h-10 px-3 py-2 bg-surface text-text border rounded-[var(--radius-sm,4px)] text-sm transition-colors placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:bg-bg-subtle disabled:cursor-not-allowed ${
          error ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
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

export default Input;
