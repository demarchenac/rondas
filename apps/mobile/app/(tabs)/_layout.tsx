import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TAB_COLORS, ICON_COLORS } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { useNewBillAction } from '@/hooks/useNewBillAction';
import LiquidGlassMenu from '@/components/ui/LiquidGlassMenu';

const FAB_SIZE = 56;
const FAB_RIGHT = 20;

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const colors = TAB_COLORS[colorScheme ?? 'light'];
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const insets = useSafeAreaInsets();
  const { pickFromCamera, pickFromLibrary, createBlankBill } = useNewBillAction();
  const glassAvailable = isGlassEffectAPIAvailable();

  const [menuVisible, setMenuVisible] = useState(false);
  const fabRotation = useSharedValue(0);

  const fabBottom = insets.bottom + 70;

  const handleFabPress = () => {
    const next = !menuVisible;
    setMenuVisible(next);
    fabRotation.value = withSpring(next ? 45 : 0, { damping: 18, stiffness: 280 });
  };

  const handleMenuClose = () => {
    setMenuVisible(false);
    fabRotation.value = withSpring(0, { damping: 18, stiffness: 280 });
  };

  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));

  const menuItems = [
    {
      id: 'camera',
      label: t.home_takePhoto,
      icon: <IconSymbol name="camera.fill" size={20} color="#fff" />,
      onPress: pickFromCamera,
    },
    {
      id: 'gallery',
      label: t.home_chooseLibrary,
      icon: <IconSymbol name="photo.on.rectangle" size={20} color="#fff" />,
      onPress: pickFromLibrary,
    },
    {
      id: 'manual',
      label: t.gate_manualEntry,
      icon: <IconSymbol name="square.and.pencil" size={20} color="#fff" />,
      onPress: createBlankBill,
    },
  ];

  return (
    <View className="flex-1">
      <NativeTabs tintColor={colors.active}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="doc.text.fill" />
          <NativeTabs.Trigger.Label>{t.tabs_home}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>{t.tabs_settings}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="add" hidden />
      </NativeTabs>

      <Pressable
        onPress={handleFabPress}
        className="absolute"
        style={{ bottom: fabBottom, right: FAB_RIGHT }}
      >
        {glassAvailable ? (
          <GlassView
            isInteractive
            style={{ width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View style={fabIconStyle}>
              <IconSymbol name="plus" size={24} color={iconColors.primary} />
            </Animated.View>
          </GlassView>
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Animated.View style={fabIconStyle}>
              <IconSymbol name="plus" size={24} color={iconColors.primaryForeground} />
            </Animated.View>
          </View>
        )}
      </Pressable>

      <LiquidGlassMenu
        items={menuItems}
        visible={menuVisible}
        onClose={handleMenuClose}
        anchorBottom={fabBottom + FAB_SIZE}
        anchorRight={FAB_RIGHT}
      />
    </View>
  );
}
