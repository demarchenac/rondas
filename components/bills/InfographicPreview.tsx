import React, { useCallback } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

const CHROME_HEIGHT = 12 + 16 + 56 + 16;
const DISMISS_THRESHOLD = 80;

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const imageWidth = screenWidth - 64;
  const translateY = useSharedValue(0);

  const dismiss = useCallback(() => { onClose(); }, [onClose]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        runOnJS(dismiss)();
      }
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible || !uri) return null;

  const imageHeight = imageWidth / imageAspect;
  const contentHeight = Math.min(imageHeight + CHROME_HEIGHT + insets.bottom + 16, screenHeight * 0.9);

  return (
    <View className="absolute inset-0" style={{ zIndex: 100 }}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      {/* Sheet with follow-finger swipe */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(200)}
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
            <Pressable
              onPress={onShare}
              className="items-center justify-center rounded-2xl bg-primary py-4"
            >
              <Text className="text-base font-bold text-primary-foreground">
                {t.share_share}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default React.memo(InfographicPreview);
