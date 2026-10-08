
export default function CountdownTimer({ secondsLeft, totalSeconds = 20, size = 110 }) {
  const isCompact = size <= 48;
  const strokeWidth = isCompact ? 3.5 : 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const strokeDashoffset = circumference * (1 - fraction);

  // Dynamic status color based on remaining fraction
  let strokeClass = 'stroke-accent';
  if (fraction < 0.25) {
    strokeClass = 'stroke-danger';
  } else if (fraction < 0.5) {
    strokeClass = 'stroke-warning';
  }

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        {/* Background track using border token */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated countdown indicator using accent/status token */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${strokeClass} transition-all duration-300 ease-linear`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`${
            isCompact ? 'text-xs font-bold' : 'text-3xl font-bold'
          } text-text tracking-tight leading-none font-mono`}
        >
          {Math.max(0, secondsLeft)}
        </span>
        {!isCompact && (
          <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider mt-0.5">
            sec
          </span>
        )}
      </div>
    </div>
  );
}
