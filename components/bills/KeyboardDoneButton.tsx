import { Keyboard, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

function KeyboardDoneButton() {
  const t = useT();
  const height = useSharedValue(0);

  const opening = useSharedValue(false);

  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      opening.value = e.height > 0;
    },
    onMove: (e) => {
      'worklet';
      height.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      height.value = e.height;
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: height.value,
    opacity: opening.value ? 1 : 0,
    pointerEvents: opening.value ? 'auto' as const : 'none' as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View className="flex-row items-center justify-end px-4 py-2 bg-[#1a2540] border-t border-[#263354]">
        <Pressable
          onPress={() => Keyboard.dismiss()}
          className="rounded-lg bg-primary/10 px-5 py-1.5"
        >
          <Text className="text-sm font-semibold text-primary">{t.done}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default KeyboardDoneButton;
