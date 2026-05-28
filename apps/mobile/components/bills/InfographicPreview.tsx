import React, { useCallback } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeOut,
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useColorScheme } from 'nativewind';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';
import { ICON_COLORS } from '@/constants/colors';

const CHROME_HEIGHT = 12 + 16 + 56 + 16;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

interface InfographicPreviewProps {
  uri: string | null;
  imageAspect: number;
  visible: boolean;
  onShare: () => void;
  onClose: () => void;
}

function InfographicPreview({ uri, imageAspect, visible, onShare, onClose }: InfographicPreviewProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const useGlass = isGlassEffectAPIAvailable();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const imageWidth = screenWidth - 64;
  const translateY = useSharedValue(0);

  const dismiss = useCallback(() => { onClose(); }, [onClose]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
        const remaining = screenHeight - e.translationY;
        const speed = Math.max(e.velocityY, 800);
        const duration = Math.min(Math.max((remaining / speed) * 1000, 150), 400);
        translateY.value = withTiming(screenHeight, { duration }, () => runOnJS(dismiss)());
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible || !uri) return null;

  const imageHeight = imageWidth / imageAspect;
  const contentHeight = Math.min(imageHeight + CHROME_HEIGHT + insets.bottom + 16, screenHeight * 0.9);

  return (
    <View className="absolute inset-0" style={{ zIndex: 100 }}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background"
          style={[{ height: contentHeight, paddingBottom: insets.bottom + 8 }, sheetStyle]}
        >
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="items-center px-8"
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri }}
              style={{ width: imageWidth, aspectRatio: imageAspect }}
              contentFit="contain"
            />
          </ScrollView>

          <View className="px-6 pt-3">
            <Pressable onPress={onShare} className="active:opacity-80">
              {useGlass ? (
                <GlassView isInteractive tintColor={iconColors.primary + '0D'} style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-lg font-bold text-primary">{t.share_share}</Text>
                </GlassView>
              ) : (
                <View className="items-center justify-center rounded-2xl bg-primary py-4">
                  <Text className="text-lg font-bold text-primary-foreground">{t.share_share}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default React.memo(InfographicPreview);
