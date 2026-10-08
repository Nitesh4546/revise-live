import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import api from '../api/client.js';
import { Play, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function PlayerJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const [pin, setPin] = useState(() => searchParams.get('pin') || '');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Auto-check PIN from query parameter & check for per-pin session
  useEffect(() => {
    const qPin = searchParams.get('pin');
    if (qPin) {
      const cleanQPin = qPin.replace(/\D/g, '');
      setPin(cleanQPin);

      // Check if player has an active session for this specific PIN
      const savedRaw = localStorage.getItem(`reviselive:player:${cleanQPin}`);
      if (savedRaw && connected && socket) {
        try {
          const saved = JSON.parse(savedRaw);
          if (saved.playerId && saved.reconnectToken) {
            socket.emit('player:rejoin', { pin: cleanQPin, playerId: saved.playerId, reconnectToken: saved.reconnectToken }, (res) => {
              if (res.ok) {
                navigate(`/play?pin=${cleanQPin}`);
              }
            });
          }
        } catch {
          localStorage.removeItem(`reviselive:player:${cleanQPin}`);
        }
      }
    }
  }, [searchParams, socket, connected, navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPin = pin.trim().replace(/\D/g, '');
    const cleanName = name.trim();

    if (!cleanPin || cleanPin.length !== 6) {
      setError('Please enter a valid 6-digit game PIN.');
      return;
    }
    if (!cleanName) {
      setError('Please enter a nickname.');
      return;
    }

    setJoining(true);

    try {
      // 1. Pre-validate room status via REST
      setCheckingRoom(true);
      const roomCheck = await api.get(`/api/rooms/${cleanPin}`);
      setCheckingRoom(false);

      if (!roomCheck.data.exists) {
        setError('Room not found. Check the PIN on the screen.');
        setJoining(false);
        return;
      }
      if (roomCheck.data.locked) {
        setError('This game room has been locked by the teacher.');
        setJoining(false);
        return;
      }
      if (roomCheck.data.status !== 'LOBBY') {
        setError('This game has already started.');
        setJoining(false);
        return;
      }

      // 2. Emit socket player:join
      if (!socket || !connected) {
        setError('Connecting to game server. Please try again in a moment.');
        setJoining(false);
        return;
      }

      socket.emit('player:join', { pin: cleanPin, name: cleanName }, (res) => {
        setJoining(false);
        if (res.ok && res.data) {
          // Store player token per game key: reviselive:player:{pin}
          localStorage.setItem(
            `reviselive:player:${cleanPin}`,
            JSON.stringify({
              pin: cleanPin,
              playerId: res.data.playerId,
              reconnectToken: res.data.reconnectToken,
              name: res.data.name
            })
          );

          setJoined(true);
          navigate(`/play?pin=${cleanPin}`);
        } else {
          setError(res.error?.message || 'Failed to join game.');
        }
      });
    } catch (err) {
      setJoining(false);
      setCheckingRoom(false);
      setError(err.response?.data?.error?.message || 'Network error verifying game room.');
    }
  };

  return (
    <div className="min-h-screen bg-bg-subtle text-text flex flex-col justify-between selection:bg-accent selection:text-accent-foreground px-4 py-6">
      <ConnectionBanner />

      <header className="w-full max-w-sm mx-auto flex items-center justify-between pt-2 pb-4">
        <div className="inline-flex items-center gap-2">
          <div className="w-7 h-7 rounded-[var(--radius-sm,4px)] bg-accent flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-accent-foreground rounded-xs" />
          </div>
          <span className="text-base font-bold text-text">
            ReviseLive
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {joined ? (
          <div className="w-full bg-surface border border-border rounded-[var(--radius-lg,8px)] p-8 text-center shadow-xs">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-2">You&apos;re in, {name}!</h2>
            <p className="text-sm text-text-muted">
              Look up at the classroom projector screen. The quiz will begin shortly.
            </p>
          </div>
        ) : (
          <div className="w-full bg-surface border border-border rounded-[var(--radius-lg,8px)] p-6 sm:p-8 shadow-xs">
            <h1 className="text-2xl font-semibold text-text text-center mb-1">
              Join live quiz
            </h1>
            <p className="text-xs text-text-muted text-center mb-6">
              Enter the 6-digit game PIN shown on the board
            </p>

            {error && (
              <div role="alert" className="mb-6 p-3 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] flex items-start gap-2.5 text-danger text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Game PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 842190"
                  className="w-full bg-bg border border-border rounded-[var(--radius-sm,4px)] px-4 py-3 text-2xl tracking-widest text-center font-bold text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus font-mono transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Your Nickname
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.get('/api/nicknames/random');
                        if (res.data?.nickname) setName(res.data.nickname);
                      } catch {
                        setName('SwiftOtter');
                      }
                    }}
                    className="text-xs text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Pick a name</span>
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={20}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya or Alex"
                  className="w-full bg-bg border border-border rounded-[var(--radius-sm,4px)] px-4 py-2.5 text-base text-center font-medium text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus transition"
                />
                <span className="text-[10px] text-text-muted text-right block mt-1">
                  1–20 characters, visible to class
                </span>
              </div>

              <button
                type="submit"
                disabled={joining || checkingRoom || !pin || !name}
                className="w-full mt-4 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-foreground font-bold text-base rounded-[var(--radius-sm,4px)] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {joining || checkingRoom ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Enter Game</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-text-muted pt-6 pb-2">
        ReviseLive student portal • No account required
      </footer>
    </div>
  );
}
