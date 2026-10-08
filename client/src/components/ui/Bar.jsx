/**
 * Universal, robust Bar primitive for vertical and horizontal progress, meters, and distribution charts.
 * 
 * Sizing & Layout Invariants:
 * - When value/count === 0, renders ZERO fill (no sliver, no minimum height, display: none).
 * - When value/count > 0, guarantees a minimum visual presence (default minNonZeroPx = 6px).
 * - When value/count === max, fills the track completely (100%).
 * - Motion-safe: skips animations when `prefers-reduced-motion` is active.
 * - Accessible contrast: 1px subtle border on track ensures at least 3:1 contrast against surface in both themes.
 */
export default function Bar({
  value = 0,
  max = 100,
  orientation = 'vertical', // 'vertical' | 'horizontal'
  color = 'bg-accent',
  trackClassName = '',
  fillClassName = '',
  minNonZeroPx = 6,
  showTrackBorder = true,
  isCorrect = false,
  isDimmed = false,
  role,
  ariaLabel,
  ariaValuenow,
  ariaValuemin = 0,
  ariaValuemax = 100,
  style = {},
  children,
}) {
  const numVal = Math.max(0, Number(value) || 0);
  const numMax = Math.max(0, Number(max) || 0);

  const ratio = numMax > 0 ? Math.min(1, numVal / numMax) : 0;
  const isVertical = orientation === 'vertical';

  // Compute fill style
  let fillStyle = {};
  if (numVal === 0 || ratio <= 0) {
    // Strictly zero fill: NO sliver
    fillStyle = {
      display: 'none',
      width: isVertical ? '100%' : '0px',
      height: isVertical ? '0px' : '100%',
      transform: isVertical ? 'scaleY(0)' : 'scaleX(0)',
    };
  } else if (ratio >= 1) {
    // 100% full fill
    fillStyle = {
      width: '100%',
      height: '100%',
      transform: isVertical ? 'scaleY(1)' : 'scaleX(1)',
      transformOrigin: isVertical ? 'bottom' : 'left',
    };
  } else {
    // Non-zero fill with minNonZeroPx guarantee
    if (isVertical) {
      fillStyle = {
        width: '100%',
        height: `${ratio * 100}%`,
        minHeight: `${minNonZeroPx}px`,
        transformOrigin: 'bottom',
      };
    } else {
      fillStyle = {
        height: '100%',
        width: `${ratio * 100}%`,
        minWidth: `${minNonZeroPx}px`,
        transformOrigin: 'left',
      };
    }
  }

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      aria-valuenow={ariaValuenow !== undefined ? ariaValuenow : numVal}
      aria-valuemin={ariaValuemin}
      aria-valuemax={ariaValuemax !== undefined ? ariaValuemax : numMax}
      className={`relative overflow-hidden ${
        isVertical ? 'flex flex-col justify-end' : 'flex items-center'
      } bg-bg-subtle ${
        showTrackBorder ? 'border border-border' : ''
      } ${
        isCorrect ? 'ring-2 ring-success border-success' : ''
      } ${trackClassName}`}
      style={style}
    >
      <div
        data-testid="bar-fill"
        data-scale={ratio}
        data-percentage={Math.round(ratio * 100)}
        className={`${color} rounded-t-[var(--radius-xs,2px)] transition-all duration-300 ease-out motion-reduce:transition-none ${
          isDimmed ? 'opacity-40' : 'opacity-100'
        } ${fillClassName}`}
        style={fillStyle}
      />
      {children}
    </div>
  );
}
