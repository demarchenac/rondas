import { Keyboard, Platform, Pressable, View , useColorScheme } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';

export const KEYBOARD_ACCESSORY_ID = 'rondas-keyboard-toolbar';

export function KeyboardToolbar() {
  const colorScheme = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const keyboardHeight = useSharedValue(0);
  const isVisible = useSharedValue(0);

  useKeyboardHandler({
    onMove: (e) => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onStart: (e) => {
      'worklet';
      if (e.height > 0) isVisible.value = withTiming(1, { duration: 150 });
    },
    onEnd: (e) => {
      'worklet';
      if (e.height === 0) isVisible.value = withTiming(0, { duration: 100 });
    },
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: keyboardHeight.value,
    opacity: isVisible.value,
    pointerEvents: isVisible.value > 0.5 ? 'auto' as const : 'none' as const,
  }));

  if (Platform.OS !== 'ios') return null;

  return (
    <Animated.View style={animatedStyle}>
      <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
        <View
          style={{
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backgroundColor: colorScheme === 'dark' ? 'rgba(40,40,45,0.85)' : 'rgba(242,242,247,0.85)',
          }}
        >
          <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} className="active:opacity-60">
            <IconSymbol name="checkmark" size={20} color={iconColors.primary} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
