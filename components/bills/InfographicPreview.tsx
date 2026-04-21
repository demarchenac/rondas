import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

const CHROME_HEIGHT = 12 + 16 + 56 + 16; // grabber + imagePad + button + buttonPad

interface InfographicPreviewProps {
  uri: string | null;
  visible: boolean;
  onShare: () => void;
  onClose: () => void;
}

function InfographicPreview({ uri, visible, onShare, onClose }: InfographicPreviewProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const imageWidth = screenWidth - 64;
  const [imageAspect, setImageAspect] = useState(0.55);

  const handleLoad = useCallback((e: { source: { width: number; height: number } }) => {
    const { width, height } = e.source;
    if (width > 0 && height > 0) setImageAspect(width / height);
  }, []);

  useEffect(() => {
    if (!visible) setImageAspect(0.55);
  }, [visible]);

  if (!visible) return null;

  const imageHeight = imageWidth / imageAspect;
  const contentHeight = Math.min(imageHeight + CHROME_HEIGHT + insets.bottom + 16, screenHeight * 0.9);

  return (
    <View className="absolute inset-0" style={{ zIndex: 100 }}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.duration(300).springify().damping(20)}
        exiting={SlideOutDown.duration(200)}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background"
        style={{ height: contentHeight, paddingBottom: insets.bottom + 8 }}
      >
        {/* Grabber */}
        <View className="items-center py-3">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>

        {/* Infographic */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center px-8"
          showsVerticalScrollIndicator={false}
        >
          {uri && (
            <Image
              source={{ uri }}
              style={{ width: imageWidth, aspectRatio: imageAspect }}
              contentFit="contain"
              onLoad={handleLoad}
            />
          )}
        </ScrollView>

        {/* Share button */}
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
    </View>
  );
}

export default React.memo(InfographicPreview);
