import { ArrowUp, ArrowDown, Minus, Trophy } from 'lucide-react';

export default function Leaderboard({ topPlayers = [], you = null }) {
  const getRankBadge = (rank) => {
    if (rank === 1) return 'bg-accent text-accent-fg font-bold';
    if (rank === 2) return 'bg-bg-subtle text-text border border-border font-bold';
    if (rank === 3) return 'bg-bg-subtle text-text-muted border border-border font-bold';
    return 'bg-surface text-text-muted border border-border font-medium';
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-accent" />
        <h2 className="text-2xl md:text-3xl font-bold text-text tracking-tight">
          Leaderboard
        </h2>
      </div>

      <div className="space-y-2.5">
        {topPlayers.map((player, idx) => {
          const rankChange = player.rankChange || 0;
          return (
            <div
              key={player.playerId || `${player.name}-${idx}`}
              className={`p-3.5 md:p-4 rounded-lg flex items-center justify-between border transition-all shadow-xs ${
                player.rank === 1
                  ? 'bg-accent/10 border-accent/30'
                  : 'bg-surface border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center text-sm md:text-base shrink-0 shadow-xs ${getRankBadge(
                    player.rank
                  )}`}
                >
                  {player.rank}
                </span>

                <div>
                  <span className="font-semibold text-base md:text-lg text-text block">
                    {player.name}
                  </span>
                  {player.pointsGained > 0 && (
                    <span className="text-xs font-semibold text-success flex items-center gap-1">
                      +{player.pointsGained} pts
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Rank change indicator */}
                <div className="flex items-center text-xs font-bold">
                  {rankChange > 0 ? (
                    <span className="text-success flex items-center gap-0.5" title={`Moved up ${rankChange} spots`}>
                      <ArrowUp className="w-4 h-4 stroke-[3]" />
                      <span>{rankChange}</span>
                    </span>
                  ) : rankChange < 0 ? (
                    <span className="text-danger flex items-center gap-0.5" title={`Dropped ${Math.abs(rankChange)} spots`}>
                      <ArrowDown className="w-4 h-4 stroke-[3]" />
                      <span>{Math.abs(rankChange)}</span>
                    </span>
                  ) : (
                    <span className="text-text-muted">
                      <Minus className="w-4 h-4" />
                    </span>
                  )}
                </div>

                <span className="text-lg md:text-xl font-bold text-text font-mono min-w-[70px] text-right">
                  {player.score.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Student's personal position if outside top 5 */}
      {you && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="p-3.5 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-accent text-accent-fg font-bold flex items-center justify-center text-sm">
                #{you.rank}
              </span>
              <div>
                <span className="text-xs uppercase font-bold text-accent">Your Position</span>
                <div className="text-sm font-bold text-text">Rank {you.rank}</div>
              </div>
            </div>
            <span className="text-lg font-bold text-text font-mono">
              {you.score?.toLocaleString() || 0} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
