import { useEffect, useRef, useState } from 'react';
import { TILE_CONFIG } from './AnswerTile.jsx';
import Bar from './ui/Bar.jsx';
import { Check } from 'lucide-react';

/**
 * Shared Answer Distribution Chart for Live Histogram, Reveal Views, and Projector Displays.
 *
 * Props:
 * - counts / optionCounts: Array of 4 numbers [A, B, C, D]
 * - mode: 'live' | 'reveal' (defaults to 'reveal' if correctIndex provided, else 'live')
 * - correctIndex: number | null (active only in 'reveal' mode)
 * - compact: boolean (for constrained spaces like teacher console sidebar)
 */
export default function AnswerDistributionChart({
  counts,
  optionCounts,
  mode = 'reveal',
  correctIndex = null,
  title,
  className = '',
  compact = false,
}) {
  const rawCounts = counts || optionCounts || [0, 0, 0, 0];
  const safeCounts = [
    Number(rawCounts[0]) || 0,
    Number(rawCounts[1]) || 0,
    Number(rawCounts[2]) || 0,
    Number(rawCounts[3]) || 0,
  ];

  const total = safeCounts.reduce((sum, c) => sum + c, 0);
  const isReveal = mode === 'reveal' && correctIndex !== null && correctIndex !== undefined;

  const chartTitle =
    title || (mode === 'live' ? 'Live Response Histogram' : 'Student Responses Distribution');

  // Throttled polite aria-live announcements for screen readers
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const lastAnnounceTimeRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const timeout = setTimeout(() => {
      const summary = `${chartTitle}: A: ${safeCounts[0]}, B: ${safeCounts[1]}, C: ${safeCounts[2]}, D: ${safeCounts[3]}. Total: ${total}.`;
      setLiveAnnouncement(summary);
      lastAnnounceTimeRef.current = now;
    }, Math.max(0, 2000 - (now - lastAnnounceTimeRef.current)));

    return () => clearTimeout(timeout);
  }, [chartTitle, safeCounts[0], safeCounts[1], safeCounts[2], safeCounts[3], total]);

  const pct = (idx) => (total > 0 ? Math.round((safeCounts[idx] / total) * 100) : 0);

  const ariaSummary = `${chartTitle} (${total} total): Option A: ${safeCounts[0]} (${pct(0)}%), Option B: ${safeCounts[1]} (${pct(1)}%), Option C: ${safeCounts[2]} (${pct(2)}%), Option D: ${safeCounts[3]} (${pct(3)}%).`;

  // Track height: explicit robust height
  const trackHeightClass = compact
    ? 'h-24 sm:h-28'
    : 'h-[clamp(160px,28vh,320px)]';

  return (
    <div
      role="img"
      aria-label={ariaSummary}
      className={`w-full bg-surface border border-border rounded-[var(--radius-md,8px)] p-4 sm:p-6 shadow-[var(--shadow-card)] transition-colors select-none ${className}`}
    >
      {/* Polite live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Visually hidden accessible data table */}
      <table className="sr-only">
        <caption>Student response distribution by option</caption>
        <thead>
          <tr>
            <th scope="col">Option</th>
            <th scope="col">Count</th>
            <th scope="col">Percentage</th>
            {isReveal && <th scope="col">Correct Answer</th>}
          </tr>
        </thead>
        <tbody>
          {TILE_CONFIG.map((tile, idx) => (
            <tr key={tile.letter}>
              <th scope="row">Option {tile.letter} ({tile.shapeName})</th>
              <td>{safeCounts[idx]}</td>
              <td>{pct(idx)}%</td>
              {isReveal && <td>{correctIndex === idx ? 'Yes' : 'No'}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Header with Title and Response Count */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {chartTitle} ({total} total)
        </h4>
        {total === 0 ? (
          <span className="text-xs font-medium text-text-subtle px-2 py-0.5 rounded bg-bg-subtle border border-border">
            No responses yet
          </span>
        ) : isReveal ? (
          <span className="text-xs font-semibold text-success flex items-center gap-1">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Answer Revealed</span>
          </span>
        ) : null}
      </div>

      {/* 4-column Vertical Bars Grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 items-end pt-2">
        {TILE_CONFIG.map((tile, idx) => {
          const count = safeCounts[idx];
          const countPct = pct(idx);
          const isCorrect = isReveal && correctIndex === idx;
          const isDimmed = isReveal && correctIndex !== idx;
          const Shape = tile.ShapeIcon;

          return (
            <div
              key={tile.letter}
              data-testid={`bar-container-${tile.letter.toLowerCase()}`}
              className={`flex flex-col items-center justify-end w-full min-w-0 transition-opacity duration-300 ${
                isDimmed ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {/* Count & Percentage label above bar */}
              <div className="text-center mb-1.5 w-full truncate">
                <span className="font-mono text-xs sm:text-sm font-bold text-text truncate block">
                  {`${count} · ${countPct}%`}
                </span>
              </div>

              {/* Robust Vertical Bar Track */}
              <div
                className={`w-full max-w-[56px] sm:max-w-[72px] mx-auto rounded-t-[var(--radius-sm,4px)] ${trackHeightClass}`}
              >
                <Bar
                  value={count}
                  max={total > 0 ? total : 1}
                  orientation="vertical"
                  color={tile.bgColor}
                  isCorrect={isCorrect}
                  isDimmed={isDimmed}
                  trackClassName="w-full h-full rounded-t-[var(--radius-sm,4px)] shadow-xs"
                />
              </div>

              {/* Bottom Option Identifier (Letter Chip & Shape) */}
              <div className="mt-2.5 flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[var(--radius-sm,4px)] ${tile.bgColor} flex items-center justify-center ${tile.textColor} text-xs sm:text-sm ${
                    isCorrect ? 'font-black ring-2 ring-success ring-offset-2' : 'font-bold'
                  } shadow-xs relative`}
                >
                  {tile.letter}
                  {isCorrect && (
                    <span
                      title="Correct Answer"
                      data-testid="correct-marker"
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-success text-white flex items-center justify-center shadow-xs"
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <span className="w-3.5 h-3.5 flex items-center justify-center opacity-80 text-text">
                    <Shape className="w-3.5 h-3.5" />
                  </span>
                  <span className="hidden sm:inline font-medium text-[11px] truncate max-w-[48px]">
                    {tile.shapeName}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
