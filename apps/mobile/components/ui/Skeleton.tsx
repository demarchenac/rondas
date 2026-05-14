import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function Skeleton({ width, height, borderRadius = 6, style }: SkeletonProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
  }));

  return (
    <View
      className="overflow-hidden bg-muted"
      style={[{ width, height, borderRadius }, style]}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: -200, width: 400 },
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export default React.memo(Skeleton);
