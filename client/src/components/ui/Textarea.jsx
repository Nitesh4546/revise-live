import { forwardRef, useId } from 'react';

const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    id,
    rows = 4,
    className = '',
    required = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-xs font-semibold text-text tracking-wide flex items-center justify-between"
        >
          <span>{label}</span>
          {required && <span className="text-danger text-xs">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        className={`w-full px-3 py-2 bg-surface text-text border rounded-[var(--radius-sm,4px)] text-sm transition-colors placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:bg-bg-subtle disabled:cursor-not-allowed resize-y ${
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

export default Textarea;
