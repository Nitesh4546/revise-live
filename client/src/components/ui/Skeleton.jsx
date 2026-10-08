
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-border/60 animate-pulse rounded-[var(--radius-sm,4px)] ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-5 sm:p-6 bg-surface border border-border rounded-[var(--radius-md,8px)] flex flex-col gap-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export default Skeleton;
