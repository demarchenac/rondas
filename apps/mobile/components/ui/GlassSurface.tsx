import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, type GlassStyle } from 'expo-glass-effect';

export function useGlassAvailable(): boolean {
  return useMemo(() => Platform.OS === 'ios' && isGlassEffectAPIAvailable(), []);
}

interface GlassSurfaceProps {
  children: ReactNode;
  style?: ViewStyle;
  fallbackClassName?: string;
  glassStyle?: GlassStyle;
  borderRadius?: number;
}

export function GlassSurface({
  children,
  style,
  fallbackClassName = 'bg-card rounded-[20px]',
  glassStyle = 'regular',
  borderRadius = 20,
}: GlassSurfaceProps) {
  const glassAvailable = useGlassAvailable();

  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        style={[styles.glass, { borderRadius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View className={fallbackClassName} style={style}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
  },
});
