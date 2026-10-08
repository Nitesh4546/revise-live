import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button.jsx';
import IconButton from './IconButton.jsx';

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial element
    const focusable = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
        className={`relative w-full ${maxWidth} bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-xl overflow-hidden focus:outline-none ${className}`}
      >
        <div className="p-5 sm:p-6 border-b border-border/60 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title && (
              <h2 id="dialog-title" className="text-lg font-semibold text-text tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-description" className="text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>
          {onClose && (
            <IconButton
              label="Close dialog"
              onClick={onClose}
              variant="subtle"
              className="text-text-muted hover:text-text -mr-2 -mt-2"
            >
              <X className="w-5 h-5" />
            </IconButton>
          )}
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive',
  loading = false,
}) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-muted leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default Dialog;
