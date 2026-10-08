import { useEffect, useRef } from 'react';

/**
 * Hook to request and maintain screen wake lock on mobile devices
 * prevents phones from sleeping while students are in a live game.
 */
export function useWakeLock(enabled = true) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isSubscribed = true;

    async function requestLock() {
      try {
        if (document.visibilityState === 'visible' && isSubscribed) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Silently handle devices that deny wake lock
      }
    }

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}
