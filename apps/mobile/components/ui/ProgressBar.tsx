import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  paidPercent: number;
  unpaidPercent: number;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

function ProgressBar({ paidPercent, unpaidPercent, height = 3, radius = 2, style }: ProgressBarProps) {
  const paidFlex = useSharedValue(paidPercent);
  const unpaidFlex = useSharedValue(unpaidPercent);
  const emptyFlex = useSharedValue(100 - paidPercent - unpaidPercent);

  useEffect(() => {
    paidFlex.value = withTiming(paidPercent, { duration: 400 });
    unpaidFlex.value = withTiming(unpaidPercent, { duration: 400 });
    emptyFlex.value = withTiming(Math.max(0, 100 - paidPercent - unpaidPercent), { duration: 400 });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [paidPercent, unpaidPercent]);

  const paidStyle = useAnimatedStyle(() => ({ flex: paidFlex.value }));
  const unpaidStyle = useAnimatedStyle(() => ({ flex: unpaidFlex.value }));
  const emptyStyle = useAnimatedStyle(() => ({ flex: emptyFlex.value }));

  if (paidPercent <= 0 && unpaidPercent <= 0) return null;

  return (
    <View style={[{ height, borderRadius: radius, overflow: 'hidden', flexDirection: 'row', backgroundColor: 'rgba(148,163,184,0.15)' }, style]}>
      <Animated.View style={[{
        height: '100%',
        backgroundColor: '#10b981',
        borderTopLeftRadius: radius,
        borderBottomLeftRadius: radius,
      }, paidStyle]} />
      <Animated.View style={[{
        height: '100%',
        backgroundColor: '#f59e0b',
      }, unpaidStyle]} />
      <Animated.View style={[{ height: '100%' }, emptyStyle]} />
    </View>
  );
}

export default React.memo(ProgressBar);
