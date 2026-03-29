import React from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface SwipeableItemProps {
  children: React.ReactNode;
  isDeleting: boolean;
}

function SwipeableItem({ children, isDeleting }: SwipeableItemProps) {
  const height = useSharedValue<number | null>(null);
  const animatedStyle = useAnimatedStyle(() => {
    if (!isDeleting || height.value === null) return {};
    return {
      height: withTiming(0, { duration: 300 }),
      opacity: withTiming(0, { duration: 200 }),
      overflow: 'hidden' as const,
    };
  }, [isDeleting]);

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(e) => {
        if (height.value === null) {
          height.value = e.nativeEvent.layout.height;
        }
      }}
    >
      {children}
    </Animated.View>
  );
}

export default SwipeableItem;
