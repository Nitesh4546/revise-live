import { useState, useRef, useEffect } from 'react';

export function Menu({ trigger, children, align = 'right', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  return (
    <div className="relative inline-block text-left">
      <div ref={triggerRef} onClick={toggleMenu} aria-haspopup="menu" aria-expanded={isOpen}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          className={`absolute z-40 mt-1 min-w-[180px] bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)] py-1 focus:outline-none animate-in fade-in duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${className}`}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon: Icon,
  destructive = false,
  disabled = false,
  className = '',
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        if (!disabled && onClick) {
          onClick(e);
        }
      }}
      className={`w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer select-none focus:outline-none focus:bg-surface-hover ${
        destructive
          ? 'text-danger hover:bg-danger/10'
          : 'text-text hover:bg-surface-hover hover:text-text'
      } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0 text-current" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-border/60" role="separator" />;
}

export default Menu;
