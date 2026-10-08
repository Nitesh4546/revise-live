
export function HexagonIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <polygon points="12,2 21.5,7.5 21.5,18.5 12,24 2.5,18.5 2.5,7.5" />
    </svg>
  );
}

export function StarIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <polygon points="12,1.5 15.3,8.2 22.7,9.3 17.3,14.5 18.6,21.8 12,18.3 5.4,21.8 6.7,14.5 1.3,9.3 8.7,8.2" />
    </svg>
  );
}

export function CrossIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
    </svg>
  );
}

export function CrescentIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.5 2.5a9.5 9.5 0 1 0 0 19 10.5 10.5 0 0 1 0-19z" />
    </svg>
  );
}

export const TILE_CONFIG = [
  {
    index: 0,
    letter: 'A',
    shapeName: 'Hexagon',
    ShapeIcon: HexagonIcon,
    bgColor: 'bg-tile-a',
    hoverBg: 'hover:brightness-95',
    activeBg: 'active:brightness-90',
    borderColor: 'border-transparent',
    textColor: 'text-white',
    letterChipBg: 'bg-white/20 text-white',
    shapeFill: 'text-white/80',
  },
  {
    index: 1,
    letter: 'B',
    shapeName: 'Star',
    ShapeIcon: StarIcon,
    bgColor: 'bg-tile-b',
    hoverBg: 'hover:brightness-95',
    activeBg: 'active:brightness-90',
    borderColor: 'border-transparent',
    textColor: 'text-tile-b-text',
    letterChipBg: 'bg-black/15 text-tile-b-text',
    shapeFill: 'text-tile-b-text/80',
  },
  {
    index: 2,
    letter: 'C',
    shapeName: 'Cross',
    ShapeIcon: CrossIcon,
    bgColor: 'bg-tile-c',
    hoverBg: 'hover:brightness-95',
    activeBg: 'active:brightness-90',
    borderColor: 'border-transparent',
    textColor: 'text-tile-c-text',
    letterChipBg: 'bg-black/15 text-tile-c-text',
    shapeFill: 'text-tile-c-text/80',
  },
  {
    index: 3,
    letter: 'D',
    shapeName: 'Crescent',
    ShapeIcon: CrescentIcon,
    bgColor: 'bg-tile-d',
    hoverBg: 'hover:brightness-95',
    activeBg: 'active:brightness-90',
    borderColor: 'border-transparent',
    textColor: 'text-white',
    letterChipBg: 'bg-white/20 text-white',
    shapeFill: 'text-white/80',
  },
];

export default function AnswerTile({
  index,
  text,
  onClick,
  disabled = false,
  isSelected = false,
  isCorrect = null, // null = neutral, true = correct, false = incorrect
  isDimmed = false,
  showText = true,
  large = false,
  compact = false,
  clamp = true,
  badge = null,
}) {
  const config = TILE_CONFIG[index] || TILE_CONFIG[0];
  const Shape = config.ShapeIcon;

  let stateClasses = `${config.bgColor} ${config.textColor}`;

  if (isDimmed) {
    stateClasses = 'bg-surface border-border text-text-muted opacity-30';
  } else if (isCorrect === true) {
    stateClasses = `${config.bgColor} ${config.textColor} ring-2 ring-success shadow-md`;
  } else if (isCorrect === false) {
    stateClasses = 'bg-surface border-border text-text-muted opacity-30';
  }

  if (isSelected && !disabled) {
    stateClasses += ' ring-2 ring-accent shadow-md';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Option ${config.letter} (${config.shapeName}): ${text || 'Option ' + config.letter}`}
      className={`relative w-full rounded-[var(--radius-md,8px)] p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all duration-150 select-none cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
        stateClasses
      } ${!disabled && !isDimmed ? `${config.hoverBg} ${config.activeBg}` : ''} ${
        large ? 'min-h-[90px] sm:min-h-[110px]' : compact ? 'min-h-[52px]' : 'min-h-[56px] sm:min-h-[76px]'
      }`}
    >
      {/* Letter Chip & Shape */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[var(--radius-sm,4px)] flex items-center justify-center text-base sm:text-lg font-bold shadow-xs ${config.letterChipBg}`}
        >
          {config.letter}
        </span>
        <span className={`w-5 h-5 flex items-center justify-center ${config.shapeFill}`}>
          <Shape className="w-5 h-5" />
        </span>
      </div>

      {/* Answer text */}
      {showText && text && (
        <span
          className={`font-semibold text-left tracking-normal flex-1 leading-snug break-words ${
            clamp ? 'line-clamp-3' : 'whitespace-normal'
          } ${large ? 'text-lg sm:text-2xl' : 'text-sm sm:text-base'}`}
        >
          {text}
        </span>
      )}

      {badge && (
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-black/20 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
