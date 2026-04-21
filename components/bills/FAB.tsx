import React, { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useMutation } from 'convex/react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IMAGE_QUALITY } from '@/constants/media';
import { useProGate } from '@/hooks/useProGate';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';

interface FABProps {
  bottom: number;
}

function FAB({ bottom }: FABProps) {
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const router = useRouter();
  const { extractPhotoTime, useLocation: useLocationSetting } = useSettingsStore();
  const { unlocked, isPro, showPaywall } = useProGate();
  const { user } = useAuth();
  const createBill = useMutation(api.bills.create);

  const createBlankBill = useCallback(async () => {
    if (!user) return;
    try {
      const billId = await createBill({
        userId: user.id,
        name: 'Bill',
        total: 0,
        items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
        isPro,
      });
      router.push(`/bills/${billId}` as Href);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('monthly_limit_reached')) {
        showPaywall();
        return;
      }
      if (__DEV__) console.warn('[FAB] createBlankBill error:', msg);
      Alert.alert(t.error, msg || t.error_mutationFailed);
    }
  }, [user, createBill, isPro, router, showPaywall, t]);

  const gateScanOrRun = useCallback(
    (fn: () => void) => {
      if (!unlocked) {
        showPaywall();
        return;
      }
      fn();
    },
    [unlocked, showPaywall],
  );

  const pickFromCamera = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.home_permissionNeeded, t.home_permissionCamera);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: IMAGE_QUALITY,
      exif: extractPhotoTime,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const photoTakenAt = extractPhotoTime ? (asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime) : undefined;
      const params: Record<string, string> = { imageUri: asset.uri };
      if (photoTakenAt) params.photoTakenAt = String(photoTakenAt);
      if (useLocationSetting) params.resolveLocation = 'device';
      router.push({ pathname: '/bills/new', params } as Href);
    }
  }, [router, extractPhotoTime, useLocationSetting, t]);

  const pickFromLibrary = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.home_permissionNeeded, t.home_permissionLibrary);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: IMAGE_QUALITY,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const photoTakenAt = extractPhotoTime ? (asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime) : undefined;
      const gpsLat = asset.exif?.GPSLatitude;
      const gpsLng = asset.exif?.GPSLongitude;
      const gpsLatRef = asset.exif?.GPSLatitudeRef;
      const gpsLngRef = asset.exif?.GPSLongitudeRef;
      const params: Record<string, string> = { imageUri: asset.uri };
      if (photoTakenAt) params.photoTakenAt = String(photoTakenAt);
      if (gpsLat != null && gpsLng != null) {
        params.latitude = String(gpsLatRef === 'S' ? -gpsLat : gpsLat);
        params.longitude = String(gpsLngRef === 'W' ? -gpsLng : gpsLng);
        params.resolveLocation = 'exif';
      }
      router.push({ pathname: '/bills/new', params } as Href);
    }
  }, [router, extractPhotoTime, t]);

  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.cancel, t.home_takePhoto, t.home_chooseLibrary, t.gate_manualEntry],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) gateScanOrRun(pickFromCamera);
          if (buttonIndex === 2) gateScanOrRun(pickFromLibrary);
          if (buttonIndex === 3) createBlankBill();
        },
      );
    } else {
      Alert.alert(t.home_addBill, t.home_addBillHow, [
        { text: t.cancel, style: 'cancel' },
        { text: t.home_takePhoto, onPress: () => gateScanOrRun(pickFromCamera) },
        { text: t.home_chooseLibrary, onPress: () => gateScanOrRun(pickFromLibrary) },
        { text: t.gate_manualEntry, onPress: createBlankBill },
      ]);
    }
  }, [pickFromCamera, pickFromLibrary, createBlankBill, gateScanOrRun, t]);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[animatedStyle, { bottom }]}
      className="absolute z-50 self-center"
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 300 }); }}
        className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/20"
      >
        <IconSymbol name="plus" size={28} color={iconColors.primaryForeground} />
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(FAB);
