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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: '#1a2540',
          borderTopWidth: 1,
          borderTopColor: '#263354',
        }}
      >
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#38bdf8' }}>{t.done}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default KeyboardDoneButton;
