import { createContext, useContext } from 'react';

const TabsContext = createContext(null);

export function Tabs({ value, onChange, children, className = '' }) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={`w-full flex flex-col ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className = '', 'aria-label': ariaLabel = 'Navigation Tabs' }) {
  const { onChange } = useContext(TabsContext);

  const handleKeyDown = (e) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll('[role="tab"]:not([disabled])'));
    const currentIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== currentIndex) {
      tabs[nextIndex]?.focus();
      const tabVal = tabs[nextIndex]?.getAttribute('data-value');
      if (tabVal && onChange) {
        onChange(tabVal);
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar ${className}`}
    >
      {children}
    </div>
  );
}

export function Tab({ value: tabValue, children, disabled = false, className = '' }) {
  const { value, onChange } = useContext(TabsContext);
  const isSelected = value === tabValue;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${tabValue}`}
      aria-controls={`tabpanel-${tabValue}`}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      data-value={tabValue}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(tabValue)}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer select-none whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        isSelected
          ? 'border-accent text-accent font-semibold'
          : 'border-transparent text-text-muted hover:text-text hover:border-border'
      } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value: tabValue, children, className = '' }) {
  const { value } = useContext(TabsContext);
  const isSelected = value === tabValue;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabValue}`}
      aria-labelledby={`tab-${tabValue}`}
      tabIndex={0}
      className={`py-4 focus:outline-none ${className}`}
    >
      {children}
    </div>
  );
}

export default Tabs;
