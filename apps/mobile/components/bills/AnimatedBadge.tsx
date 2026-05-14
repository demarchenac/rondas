import React, { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import type { BillState } from '@/lib/billHelpers';

interface AnimatedBadgeProps {
  variant: BillState;
  label: string;
}

function AnimatedBadge({ variant, label }: AnimatedBadgeProps) {
  const scale = useSharedValue(1);
  const prevVariant = useRef(variant);

  useEffect(() => {
    if (prevVariant.current !== variant) {
      scale.value = withSequence(
        withTiming(1.1, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
      prevVariant.current = variant;
    }
  }, [variant, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Badge variant={variant}>
        <Text>{label}</Text>
      </Badge>
    </Animated.View>
  );
}

export default React.memo(AnimatedBadge);
