import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';

export function useGlassEffect(delay = 500) {
  const glassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const [isGlassReady, setIsGlassReady] = useState(false);
  useEffect(() => {
    if (glassAvailable && !isGlassReady) {
      const id = setTimeout(() => setIsGlassReady(true), delay);
      return () => clearTimeout(id);
    }
  }, [glassAvailable, isGlassReady, delay]);
  return { glassAvailable, isGlassReady, shouldUseGlass: glassAvailable && isGlassReady };
}
