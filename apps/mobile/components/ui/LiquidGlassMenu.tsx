import React, { useEffect, useCallback } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';

export type LiquidGlassMenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

type LiquidGlassMenuProps = {
  items: LiquidGlassMenuItem[];
  visible: boolean;
  onClose: () => void;
  anchorBottom: number;
  anchorRight: number;
};

const MENU_WIDTH = 220;
const isIOS = Platform.OS === 'ios';

function LiquidGlassMenu({ items, visible, onClose, anchorBottom, anchorRight }: LiquidGlassMenuProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(1, { damping: 22, stiffness: 300 });
      opacity.value = withSpring(1, { damping: 20, stiffness: 280 });
    }
  }, [visible, scale, opacity]);

  const handleClose = useCallback(() => {
    scale.value = withSpring(0.85, { damping: 22, stiffness: 300 });
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, scale, opacity]);

  const handleItemPress = useCallback((item: LiquidGlassMenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.85, { damping: 22, stiffness: 300 });
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
        runOnJS(item.onPress)();
      }
    });
  }, [onClose, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: (MENU_WIDTH / 2) * (1 - scale.value) },
      { translateY: -(MENU_WIDTH / 2) * (1 - scale.value) },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  if (!isIOS) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
        <Pressable style={[StyleSheet.absoluteFill, styles.androidBackdrop]} onPress={onClose} />
        <View style={styles.androidCenter}>
          <View style={styles.androidCard}>
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress(); onClose(); }} style={styles.item}>
                  {item.icon}
                  <Text className="text-base font-medium text-white">{item.label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      <Animated.View
        style={[
          styles.iosCard,
          { bottom: anchorBottom + 12, right: anchorRight },
          animatedStyle,
        ]}
      >
        <BlurView intensity={80} tint="systemMaterialDark" style={StyleSheet.absoluteFill} />
        {items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(index * 55).springify().damping(18)}
          >
            {index > 0 && <View style={styles.separator} />}
            <Pressable onPress={() => handleItemPress(item)} style={styles.item}>
              {item.icon}
              <Text className="text-base font-medium text-white">{item.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iosCard: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
  },
  androidBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  androidCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidCard: {
    width: 280,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});

export default React.memo(LiquidGlassMenu);
