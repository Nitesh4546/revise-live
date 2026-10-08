import { useState, useEffect } from 'react';

/**
 * Server-synchronized countdown timer hook.
 * Calculates clock skew: offset = serverNow - Date.now()
 * Autoruns requestAnimationFrame or interval to provide smooth remaining seconds & percentage.
 */
export function useCountdown(endsAt, serverNow, totalSeconds = 20) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [percent, setPercent] = useState(100);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endsAt) return;

    // Clock offset between client and server
    const clockOffset = serverNow ? serverNow - Date.now() : 0;
    const totalMs = (totalSeconds || 20) * 1000;

    const tick = () => {
      const currentServerTime = Date.now() + clockOffset;
      const remainingMs = Math.max(0, endsAt - currentServerTime);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const calculatedPercent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

      setSecondsLeft(remainingSec);
      setPercent(calculatedPercent);

      if (remainingMs <= 0) {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [endsAt, serverNow, totalSeconds]);

  return { secondsLeft, percent, isExpired };
}
