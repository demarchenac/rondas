import React, { useCallback, useRef } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';

const REVEAL_THRESHOLD = -80;
const COMMIT_THRESHOLD = -160;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

type SwipeState = 'idle' | 'reveal' | 'commit';

interface SwipeableRowProps {
  onDelete: () => void;
  onSwipeStart?: () => void;
  bgClassName?: string;
  children: React.ReactNode;
}

function SwipeableRow({ onDelete, onSwipeStart, bgClassName, children }: SwipeableRowProps) {
  const t = useT();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const currentState = useRef<SwipeState>('idle');

  const triggerHaptic = useCallback((state: SwipeState) => {
    if (state === currentState.current) return;
    currentState.current = state;
    if (state === 'reveal') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (state === 'commit') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Haptics.selectionAsync();
    }
  }, []);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDelete();
  }, [onDelete]);

  const notifySwipeStart = useCallback(() => {
    onSwipeStart?.();
  }, [onSwipeStart]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      startX.value = translateX.value;
      runOnJS(notifySwipeStart)();
    })
    .onUpdate((e) => {
      const newX = clamp(startX.value + e.translationX, -SCREEN_WIDTH, 0);
      translateX.value = newX;

      if (newX < COMMIT_THRESHOLD) {
        runOnJS(triggerHaptic)('commit');
      } else if (newX < REVEAL_THRESHOLD) {
        runOnJS(triggerHaptic)('reveal');
      } else {
        runOnJS(triggerHaptic)('idle');
      }
    })
    .onEnd(() => {
      if (translateX.value < COMMIT_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(handleDelete)();
        });
      } else if (translateX.value < REVEAL_THRESHOLD) {
        translateX.value = withSpring(REVEAL_THRESHOLD, SPRING_CONFIG);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [COMMIT_THRESHOLD, REVEAL_THRESHOLD, 0],
      [SCREEN_WIDTH, -REVEAL_THRESHOLD, 0],
      'clamp',
    );
    const scale = interpolate(
      translateX.value,
      [COMMIT_THRESHOLD, REVEAL_THRESHOLD, 0],
      [1.2, 1, 0.5],
      'clamp',
    );
    return { width, transform: [{ scale }] };
  });

  const deleteBgStyle = useAnimatedStyle(() => ({
    backgroundColor: translateX.value < COMMIT_THRESHOLD ? '#dc2626' : '#ef4444',
  }));

  return (
    <View className="relative overflow-hidden">
      <Animated.View
        className="absolute bottom-0 right-0 top-0 items-center justify-center"
        style={[deleteStyle, deleteBgStyle]}
      >
        <Pressable onPress={handleDelete} className="items-center px-4 py-2">
          <IconSymbol name="xmark" size={18} color="#ffffff" />
          <Text className="mt-0.5 text-[10px] font-medium text-white">{t.delete}</Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle} className={bgClassName ?? 'bg-background'}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default React.memo(SwipeableRow);
