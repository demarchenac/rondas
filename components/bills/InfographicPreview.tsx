import React from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
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
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth - 48;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
          >
            <IconSymbol name="xmark" size={14} color="#fff" />
          </Pressable>
          <View className="w-9" />
        </View>

        {/* Infographic image */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center px-6 py-4"
          showsVerticalScrollIndicator={false}
        >
          {uri && (
            <Image
              source={{ uri }}
              style={{ width: imageWidth, aspectRatio: 0.55 }}
              contentFit="contain"
            />
          )}
        </ScrollView>

        {/* Footer */}
        <View className="px-6 pb-2" style={{ paddingBottom: insets.bottom + 8 }}>
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
