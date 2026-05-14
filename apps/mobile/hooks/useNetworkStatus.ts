import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Simple network status hook using navigator.onLine and event listeners.
 * Works on web and React Native (via RN's built-in NetInfo polyfill).
 * For more robust detection, consider adding @react-native-community/netinfo.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsConnected(true);
      const handleOffline = () => setIsConnected(false);
      setIsConnected(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return isConnected;
}
