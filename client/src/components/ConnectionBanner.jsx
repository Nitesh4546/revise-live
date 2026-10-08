import { WifiOff } from 'lucide-react';
import { useSocket } from '../context/SocketContext.jsx';

export default function ConnectionBanner() {
  const { connected, connecting } = useSocket();

  if (connected && !connecting) return null;

  return (
    <div className="bg-warning text-warning-fg px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 border-b border-warning/30 shadow-xs">
      <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
      <span>Connecting to live game server... Your session will resume automatically.</span>
    </div>
  );
}
