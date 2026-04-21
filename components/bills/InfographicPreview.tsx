import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

const CHROME_HEIGHT = 20 + 8 + 24 + 56 + 16; // grabber + topPad + imagePad + button + bottomPad

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
  const imageWidth = screenWidth - 48;
  const [imageAspect, setImageAspect] = useState(0.55);

  const handleLoad = useCallback((e: { source: { width: number; height: number } }) => {
    const { width, height } = e.source;
    if (width > 0 && height > 0) setImageAspect(width / height);
  }, []);

  const detent = useMemo(() => {
    const imageHeight = imageWidth / imageAspect;
    const totalHeight = imageHeight + CHROME_HEIGHT + insets.bottom;
    const fraction = Math.min(Math.max(totalHeight / screenHeight, 0.4), 0.95);
    return [fraction];
  }, [imageWidth, imageAspect, insets.bottom, screenHeight]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      // @ts-expect-error — RN 0.85 iOS sheet props, types may lag behind
      sheetAllowedDetents={detent}
      sheetGrabberVisible
    >
      <View className="flex-1 bg-background pt-2">
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center px-6 pt-2 pb-4"
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

        <View className="px-6" style={{ paddingBottom: insets.bottom + 8 }}>
          <Pressable
            onPress={onShare}
            className="items-center justify-center rounded-2xl bg-primary py-4"
          >
            <Text className="text-base font-bold text-primary-foreground">
              {t.share_share}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(InfographicPreview);
