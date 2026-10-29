import { useEffect, useState } from 'react';

export interface ConnectivityState {
  online: boolean;
}

/** A small browser boundary that makes connectivity observable by the shell. */
export const useConnectivity = (): ConnectivityState => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = (): void => setOnline(true);
    const handleOffline = (): void => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online };
};

