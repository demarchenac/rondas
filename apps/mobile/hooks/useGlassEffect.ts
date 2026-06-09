import { useMemo } from 'react';
import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';

export function useGlassEffect() {
  const shouldUseGlass = useMemo(
    () => Platform.OS === 'ios' && isGlassEffectAPIAvailable(),
    [],
  );
  return { shouldUseGlass };
}
