import { Users, X, WifiOff } from 'lucide-react';

export default function PlayerList({ players = [], onKickPlayer, showKick = true }) {
  const activeCount = players.filter((p) => p.connected && !p.left).length;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3 text-text">
        <Users className="w-4 h-4 text-accent" />
        <span className="font-semibold text-xs tracking-wider uppercase text-text-muted">
          Connected Players ({activeCount})
        </span>
      </div>

      {players.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-[var(--radius-md,8px)] text-center text-text-muted text-xs sm:text-sm bg-bg-subtle/40">
          Waiting for students to join using the PIN or QR code above...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {players.map((p) => (
            <div
              key={p.playerId}
              className={`px-3 py-1.5 rounded-[var(--radius-sm,4px)] text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors border shadow-xs ${
                p.connected && !p.left
                  ? 'bg-surface border-border text-text'
                  : 'bg-bg-subtle border-border text-text-muted opacity-60'
              }`}
            >
              {p.left ? (
                <span className="text-[10px] text-danger font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-danger/10 border border-danger/30">
                  Left
                </span>
              ) : !p.connected ? (
                <WifiOff className="w-3.5 h-3.5 text-warning shrink-0" title="Disconnected" />
              ) : null}
              <span className="truncate max-w-[150px]">{p.name}</span>

              {showKick && onKickPlayer && (
                <button
                  type="button"
                  onClick={() => onKickPlayer(p.playerId)}
                  className="text-text-muted hover:text-danger p-0.5 rounded transition-colors cursor-pointer"
                  title="Remove player"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
