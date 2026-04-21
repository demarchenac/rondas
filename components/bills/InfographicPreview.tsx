import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

interface InfographicPreviewProps {
  uri: string | null;
  visible: boolean;
  onShare: () => void;
  onClose: () => void;
}

function InfographicPreview({ uri, visible, onShare, onClose }: InfographicPreviewProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth - 48;
  const [imageAspect, setImageAspect] = useState(0.55);

  const handleLoad = useCallback((e: { source: { width: number; height: number } }) => {
    const { width, height } = e.source;
    if (width > 0 && height > 0) setImageAspect(width / height);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Drag indicator */}
        <View className="items-center pb-2 pt-3">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>

        {/* Infographic image */}
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

        {/* Footer */}
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
