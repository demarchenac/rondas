import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';

export function useGlassEffect(delay = 500) {
  const glassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const [glassReady, setGlassReady] = useState(false);
  useEffect(() => {
    if (glassAvailable && !glassReady) {
      const id = setTimeout(() => setGlassReady(true), delay);
      return () => clearTimeout(id);
    }
  }, [glassAvailable, glassReady, delay]);
  return { glassAvailable, glassReady, useGlass: glassAvailable && glassReady };
}
