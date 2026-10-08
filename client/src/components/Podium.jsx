import { Trophy, Award } from 'lucide-react';

export default function Podium({ podium = [] }) {
  const first = podium.find((p) => p.rank === 1) || podium[0];
  const second = podium.find((p) => p.rank === 2) || podium[1];
  const third = podium.find((p) => p.rank === 3) || podium[2];

  return (
    <div className="w-full max-w-2xl mx-auto pt-6 pb-2">
      <div className="flex items-end justify-center gap-3 sm:gap-5 min-h-[240px]">
        {/* 2nd Place */}
        {second && (
          <div className="flex-1 flex flex-col items-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-surface border border-border flex items-center justify-center text-text mb-2 shadow-xs">
              <Award className="w-6 h-6 text-text-muted" />
            </div>
            <span className="font-semibold text-xs sm:text-sm text-text text-center truncate max-w-[120px] mb-0.5">
              {second.name}
            </span>
            <span className="text-xs text-text-muted font-mono mb-2">
              {second.score?.toLocaleString()} pts
            </span>
            <div className="w-full h-28 sm:h-36 bg-surface border border-border border-b-0 rounded-t-[var(--radius-md,8px)] flex flex-col items-center justify-center shadow-xs">
              <span className="text-2xl sm:text-4xl font-bold text-text-muted font-mono">2</span>
              <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Silver
              </span>
            </div>
          </div>
        )}

        {/* 1st Place */}
        {first && (
          <div className="flex-1 flex flex-col items-center -mt-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center text-accent mb-2 shadow-sm">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <span className="font-bold text-sm sm:text-base text-text text-center truncate max-w-[140px] mb-0.5">
              {first.name}
            </span>
            <span className="text-xs sm:text-sm text-accent font-mono font-semibold mb-2">
              {first.score?.toLocaleString()} pts
            </span>
            <div className="w-full h-36 sm:h-48 bg-surface border border-border border-b-0 rounded-t-[var(--radius-md,8px)] flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl sm:text-5xl font-bold text-accent font-mono">1</span>
              <span className="text-xs uppercase font-bold text-accent tracking-wider">
                1st Place
              </span>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div className="flex-1 flex flex-col items-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted mb-2 shadow-xs">
              <Award className="w-6 h-6 text-text-muted" />
            </div>
            <span className="font-semibold text-xs sm:text-sm text-text text-center truncate max-w-[120px] mb-0.5">
              {third.name}
            </span>
            <span className="text-xs text-text-muted font-mono mb-2">
              {third.score?.toLocaleString()} pts
            </span>
            <div className="w-full h-20 sm:h-28 bg-surface border border-border border-b-0 rounded-t-[var(--radius-md,8px)] flex flex-col items-center justify-center shadow-xs">
              <span className="text-xl sm:text-3xl font-bold text-text-muted font-mono">3</span>
              <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Bronze
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
