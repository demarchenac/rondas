import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { IMAGE_QUALITY } from '@/constants/media';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/lib/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProGate } from '@/hooks/useProGate';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { useT } from '@/lib/i18n';

export function useNewBillAction() {
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const { alert, actionSheet } = useCustomAlert();
  const { isPro, unlocked, showPaywall } = useProGate();
  const { extractPhotoTime, useLocation: useLocationSetting } = useSettingsStore();
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
      if (__DEV__) console.warn('[NewBill] createBlankBill error:', msg);
      alert(t.error, msg || t.error_mutationFailed);
    }
  }, [user, createBill, isPro, router, showPaywall, t, alert]);

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
      alert(t.home_permissionNeeded, t.home_permissionCamera);
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
  }, [router, extractPhotoTime, useLocationSetting, t, alert]);

  const pickFromLibrary = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert(t.home_permissionNeeded, t.home_permissionLibrary);
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
  }, [router, extractPhotoTime, t, alert]);

  const openNewBillSheet = useCallback(() => {
    actionSheet({
      options: [t.cancel, t.home_takePhoto, t.home_chooseLibrary, t.gate_manualEntry],
      cancelButtonIndex: 0,
      onSelect: (buttonIndex) => {
        if (buttonIndex === 1) gateScanOrRun(pickFromCamera);
        if (buttonIndex === 2) gateScanOrRun(pickFromLibrary);
        if (buttonIndex === 3) createBlankBill();
      },
    });
  }, [pickFromCamera, pickFromLibrary, createBlankBill, gateScanOrRun, t, actionSheet]);

  return { openNewBillSheet, pickFromCamera: () => gateScanOrRun(pickFromCamera), pickFromLibrary: () => gateScanOrRun(pickFromLibrary), createBlankBill };
}
