import { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';

const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    id,
    checked = false,
    onChange,
    disabled = false,
    className = '',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 select-none cursor-pointer group ${
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
    >
      <div className="relative flex items-center justify-center shrink-0 mt-0.5">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <div className="w-4 h-4 rounded-[var(--radius-sm,4px)] border border-border bg-surface peer-checked:bg-accent peer-checked:border-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 flex items-center justify-center">
          {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-text">{label}</span>}
          {description && <span className="text-xs text-text-muted">{description}</span>}
        </div>
      )}
    </label>
  );
});

export default Checkbox;
