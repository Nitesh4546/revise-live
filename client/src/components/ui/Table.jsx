
export function Table({ children, className = '', containerClassName = '' }) {
  return (
    <div className={`w-full overflow-x-auto border border-border rounded-[var(--radius-md,8px)] ${containerClassName}`}>
      <table className={`w-full text-left text-sm text-text border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', sticky = false }) {
  return (
    <thead
      className={`bg-bg-subtle text-text-muted text-xs uppercase font-semibold border-b border-border ${
        sticky ? 'sticky top-0 z-10 backdrop-blur-xs' : ''
      } ${className}`}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }) {
  return <tbody className={`divide-y divide-border ${className}`}>{children}</tbody>;
}

export function TableRow({ children, className = '', selected = false, onClick }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${
        selected ? 'bg-accent/10 font-semibold' : 'hover:bg-surface-hover/70'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '' }) {
  return (
    <th scope="col" className={`px-4 py-3 font-semibold text-xs text-text-muted ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }) {
  return <td className={`px-4 py-3 text-text align-middle ${className}`}>{children}</td>;
}

export default Table;
