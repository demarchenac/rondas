import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
} from 'react-native';
import * as Sentry from '@sentry/react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAction, useMutation, useQuery } from 'convex/react';
import { randomUUID } from 'expo-crypto';
import type { Id } from '@convex/_generated/dataModel';

import { getErrorCode, getErrorMessage } from '@/lib/convexError';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@convex/_generated/api';
import { resolvePlace } from '@/lib/places';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride } from '@/constants/taxes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatCurrency, parseCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';
import SwipeableItem from '@/components/bills/SwipeableItem';
import KeyboardDoneButton from '@/components/bills/KeyboardDoneButton';
import ScanningOverlay from '@/components/bills/ScanningOverlay';
import { useProGate } from '@/hooks/useProGate';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { posthog } from '@/lib/posthog';

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

function generateItemId(): string {
  return randomUUID();
}

interface ExtractedBill {
  name?: string;
  items: BillItem[];
  tax: number;
  tip: number;
  total: number;
}

function prepareItems(items: BillItem[]): BillItem[] {
  return items
    .filter((item) => item.name.trim() !== '')
    .map((item) => ({
      ...item,
      id: item.id || generateItemId(),
      name: item.name.trim().replace(/^\w/, (char) => char.toUpperCase()),
      unitPrice: item.quantity > 0 ? item.subtotal / item.quantity : item.subtotal,
    }));
}

export default function NewBillScreen() {
  const { imageUri, photoTakenAt, latitude, longitude, resolveLocation } = useLocalSearchParams<{
    imageUri: string;
    photoTakenAt?: string;
    latitude?: string;
    longitude?: string;
    resolveLocation?: 'device' | 'exif';
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { user } = useAuth();
  const t = useT();
  const { country } = useSettingsStore();

  const extractItems = useAction(api.ai.extractBillItems);
  const createScan = useMutation(api.scans.createScan);
  const deleteScan = useMutation(api.scans.deleteScan);
  const createBill = useMutation(api.bills.create);
  const { isPro } = useProGate();
  const { alert } = useCustomAlert();
  const [scanId, setScanId] = useState<Id<'scans'> | null>(null);
  const scanProgress = useQuery(
    api.scans.getScan,
    scanId && user ? { id: scanId } : 'skip'
  );

  // Resolve place name in background
  const [placeData, setPlaceData] = useState<{
    placeName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }>({});

  useEffect(() => {
    if (!resolveLocation) return;

    let cancelled = false;

    async function resolve() {
      try {
        if (resolveLocation === 'device') {
          // Camera: get device GPS first, then resolve
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted' || cancelled) return;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          const place = await resolvePlace(loc.coords.latitude, loc.coords.longitude);
          if (cancelled) return;
          setPlaceData({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            placeName: place?.name,
            address: place?.address,
          });
          return;
        }

        if (resolveLocation === 'exif' && latitude && longitude) {
          // Library: resolve from EXIF GPS
          const parsedLat = parseFloat(latitude);
          const parsedLng = parseFloat(longitude);
          const place = await resolvePlace(parsedLat, parsedLng);
          if (cancelled) return;
          setPlaceData({
            latitude: parsedLat,
            longitude: parsedLng,
            placeName: place?.name,
            address: place?.address,
          });
        }
      } catch (err) {
        console.warn('[NewBill] location resolve failed:', err);
        Sentry.captureException(err, { tags: { feature: 'new_bill' } });
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [resolveLocation, latitude, longitude]);

  const metadataParams = {
    ...(photoTakenAt ? { photoTakenAt } : {}),
    ...(placeData.latitude && placeData.longitude ? {
      location: {
        latitude: placeData.latitude,
        longitude: placeData.longitude,
        ...(placeData.address ? { address: placeData.address } : {}),
      },
    } : {}),
  };

  type ScanErrorType = 'timeout' | 'api' | 'not_a_receipt' | 'generic';
  interface ScanError { type: ScanErrorType; message: string; hint: string; }

  function classifyScanError(err: unknown): ScanError {
    const code = getErrorCode(err);
    const errorMessage = getErrorMessage(err).toLowerCase();
    if (code === 'NOT_A_RECEIPT' || errorMessage.includes('not_a_receipt')) {
      return { type: 'not_a_receipt', message: t.error_notReceipt, hint: t.error_hintNotReceipt };
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return { type: 'timeout', message: t.error_timeout, hint: t.error_hintTimeout };
    }
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return { type: 'api', message: t.error_rateLimited, hint: t.error_hintRateLimited };
    }
    if (errorMessage.includes('403')) {
      return { type: 'api', message: t.error_serviceUnavailable, hint: t.error_hintServiceUnavailable };
    }
    if (errorMessage.includes('500') || errorMessage.includes('503')) {
      return { type: 'api', message: t.error_api, hint: t.error_hintApi };
    }
    if (errorMessage.includes('failed to parse')) {
      return { type: 'generic', message: t.error_parseError, hint: t.error_hintParseError };
    }
    return { type: 'generic', message: t.error_scanGeneric, hint: t.error_hintScan };
  }

  type ScanPhase = 'uploading' | 'analyzing' | 'thinking' | 'extracting' | 'complete';
  const [isScanning, setScanning] = useState(false);
  const [localPhase, setLocalPhase] = useState<ScanPhase>('uploading');
  const [isSaving, setSaving] = useState(false);
  const [bill, setBill] = useState<ExtractedBill | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const swipeOpenRef = useRef(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const navigation = useNavigation();

  // Prevent dismiss when bill data exists — shows confirmation alert
  useEffect(() => {
    if (!bill) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      alert(
        t.scan_discardTitle,
        t.scan_discardMessage,
        [
          { text: t.scan_keepEditing, style: 'cancel' },
          {
            text: t.scan_discard,
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, bill, t, alert]);

  const handleItemPress = useCallback((index: number) => {
    // Don't open edit mode if a swipe just happened
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingIndex(index);
  }, []);

  const handleScan = async () => {
    if (!imageUri || !user) return;
    setError(null);
    setScanning(true);
    setLocalPhase('uploading');
    posthog.capture('bill_scan_started', { attempt_number: scanAttempts + 1, has_location: !!placeData.latitude });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const minPhaseDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 700));

    try {
      // "Subiendo imagen..." phase — local, before any backend state
      const [compressed] = await Promise.all([
        manipulateAsync(
          imageUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: SaveFormat.JPEG },
        ),
        minPhaseDelay(),
      ]);

      const file = new ExpoFile(compressed.uri);
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);

      // Transition to backend-driven phases
      setLocalPhase('analyzing');

      const newScanId = await createScan({});
      setScanId(newScanId);

      const result = await extractItems({ imageBase64: base64, mimeType: 'image/jpeg', scanId: newScanId, isPro });

      // Celebration: show completion state while creating bill in parallel
      setLocalPhase('complete');

      const createBillAsync = async () => {
        const preparedItems = prepareItems(
          result.items.map((item) => ({ ...item, id: generateItemId() }))
        );

        const { country, defaultTipPercent, impoconsumoIncluded, ivaIncluded } = useSettingsStore.getState();
        const category = result.category || 'dining';
        const itemsTotal = preparedItems.reduce((total, item) => total + item.subtotal, 0);
        const rawTaxConfig = getTaxConfig(country, category);

        const taxIncludedOverride = country === 'CO'
          ? (category === 'dining' ? impoconsumoIncluded : ivaIncluded)
          : undefined;
        const taxConfig = withTaxIncludedOverride(rawTaxConfig, taxIncludedOverride);

        const base = computeBase(itemsTotal, taxConfig);
        const tax = computeTax(itemsTotal, taxConfig);
        const tip = base * (defaultTipPercent / 100);
        const calculatedTotal = base + tax + tip;

        const itemsForDB = preparedItems.map(({ id: _id, ...rest }) => rest);

        return createBill({
          name: placeData.placeName || 'Bill',
          total: calculatedTotal,
          tax,
          tip,
          tipPercent: defaultTipPercent,
          items: itemsForDB,
          category,
          country,
          taxIncludedOverride,
          decimalPlaces: result.decimalPlaces,
          isPro,
          ...metadataParams,
        });
      };

      // Show celebration for 800ms while bill creation runs in parallel
      const [billId] = await Promise.all([
        createBillAsync(),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ]);

      if (newScanId) deleteScan({ id: newScanId }).catch((err) => { console.warn('[NewBill] mutation failed:', err); Sentry.captureException(err, { tags: { feature: 'new_bill' } }); });
      posthog.capture('bill_scan_succeeded', {
        item_count: result.items.length,
        category: result.category ?? 'dining',
        country,
        has_location: !!placeData.latitude,
      });
      posthog.capture('bill_created', { creation_method: 'scan', item_count: result.items.length, country, is_pro: isPro });
      setScanAttempts(0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bills/${billId}` as Href);
    } catch (err) {
      console.error('[Scan] Error:', err);
      const classified = classifyScanError(err);
      Sentry.captureException(err, {
        tags: { feature: 'bill_scan', errorType: classified.type },
        extra: { scanId, attempts: scanAttempts + 1 },
      });
      posthog.capture('bill_scan_failed', { error_type: classified.type, attempts: scanAttempts + 1 });
      setScanAttempts((prev) => prev + 1);
      setError(classified);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScanning(false);
      setLocalPhase('uploading');
      setScanId(null);
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string) => {
    if (!bill) return;
    const items = [...bill.items];
    if (field === 'name') {
      items[index] = { ...items[index], name: value };
      setBill({ ...bill, items });
      return;
    }
    const num = parseCurrency(value, country);
    items[index] = { ...items[index], [field]: num };
    if (field === 'quantity' || field === 'unitPrice') {
      items[index].subtotal = items[index].quantity * items[index].unitPrice;
    }
    setBill({ ...bill, items });
  };

  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const handleRemoveItem = (index: number) => {
    if (!bill) return;
    const snapshot = { ...bill, items: [...bill.items] };
    setDeletingIndex(index);
    setTimeout(() => {
      const items = snapshot.items.filter((_, i) => i !== index);
      setBill({ ...snapshot, items });
      setDeletingIndex(null);
    }, 300);
  };

  const handleAddItem = () => {
    if (!bill) return;
    setBill({
      ...bill,
      items: [...bill.items, { id: generateItemId(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
    });
  };

  const calculatedTotal = bill
    ? bill.items.reduce((total, item) => total + item.subtotal, 0) + bill.tax + bill.tip
    : 0;

  const handleConfirm = async () => {
    if (!bill || !user) return;
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const savedItems = bill.items.filter((item) => item.name.trim() !== '');
      await createBill({
        name: bill.name || 'Bill',
        total: calculatedTotal,
        tax: bill.tax,
        tip: bill.tip,
        items: savedItems,
        isPro,
      });
      posthog.capture('bill_created', { creation_method: 'manual', item_count: savedItems.length, country, is_pro: isPro });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBill(null); // Clear bill so usePreventRemove allows navigation
      router.replace('/(tabs)' as Href);
    } catch (err) {
      console.error('[Save] Error:', err);
      Sentry.captureException(err, { tags: { feature: 'new_bill' } });
      alert(t.error, t.scan_saveError);
    } finally {
      setSaving(false);
    }
  };

  // --- No image state ---
  if (!imageUri) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-xl font-semibold text-foreground">
          {t.scan_noImage}
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Text>{t.back}</Text>
        </Button>
      </View>
    );
  }

  // --- Scan state (no items yet) ---
  if (!bill) {
    return (
      <View className="flex-1 bg-background">
        {/* Full-screen image background */}
        <Image
          source={{ uri: imageUri }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />

        {/* Drag indicator */}
        <View className="z-10 items-center pt-3">
          <View className="h-1 w-10 rounded-sm bg-white/50" />
        </View>

        {/* Bottom gradient + controls */}
        <View className="flex-1 justify-end">
          <LinearGradient
            colors={['transparent', 'rgba(18,26,46,0.85)', 'rgba(18,26,46,0.95)']}
            locations={[0, 0.5, 1]}
            style={{ paddingBottom: insets.bottom + 8, paddingHorizontal: 28, paddingTop: 100 }}
          >
            {/* Error toast */}
            {error && (
              <View className="mb-4 overflow-hidden rounded-[14px]">
                <BlurView intensity={80} tint="dark" className="px-4 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                  <Pressable onPress={error.type === 'not_a_receipt' ? () => router.back() : handleScan}>
                    <View className="flex-row items-center justify-center gap-2">
                      <IconSymbol
                        name={error.type === 'timeout' ? 'wifi.slash' : 'exclamationmark.triangle'}
                        size={16}
                        color={iconColors.destructive}
                      />
                      <Text className="text-base font-medium text-white">
                        {error.message}
                      </Text>
                    </View>
                    <Text className="mt-1 text-center text-sm text-white/60">
                      {error.hint}
                    </Text>
                    <Text className="mt-1.5 text-center text-sm font-semibold text-primary">
                      {error.type === 'not_a_receipt' ? t.scan_tapGoBack : t.scan_tapRetry}
                    </Text>
                  </Pressable>
                  {scanAttempts >= 2 && (
                    <Pressable
                      onPress={async () => {
                        if (!user) return;
                        const billId = await createBill({
                          name: placeData.placeName || 'Bill',
                          total: 0,
                          items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
                          isPro,
                          ...metadataParams,
                        });
                        router.replace(`/bills/${billId}` as Href);
                      }}
                      className="mt-2 items-center border-t border-white/10 pt-2"
                    >
                      <Text className="text-sm font-semibold text-muted-foreground">
                        {t.scan_enterManually}
                      </Text>
                    </Pressable>
                  )}
                </BlurView>
              </View>
            )}

            {/* Scan button — glass with primary tint */}
            {!isScanning && (
              <>
                <Pressable
                  onPress={handleScan}
                  className="overflow-hidden rounded-2xl border border-primary/30"
                >
                  <BlurView
                    intensity={60}
                    tint="dark"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      paddingVertical: 16,
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    }}
                  >
                    <IconSymbol name="doc.text.viewfinder" size={22} color={iconColors.primary} />
                    <Text className="text-xl font-semibold text-white">
                      {t.scan_scanBill}
                    </Text>
                  </BlurView>
                </Pressable>

                {/* Manual entry link */}
                <Pressable
                  onPress={async () => {
                    if (!user) return;
                    posthog.capture('bill_manual_entry_started');
                    const billId = await createBill({
                      name: placeData.placeName || 'Bill',
                      total: 0,
                      items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
                      ...metadataParams,
                    });
                    router.replace(`/bills/${billId}` as Href);
                  }}
                  className="items-center py-4"
                >
                  <Text className="text-base font-medium text-muted-foreground">
                    {t.scan_enterManually}
                  </Text>
                </Pressable>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Scanning overlay */}
        {isScanning && (
          <ScanningOverlay scanProgress={scanProgress} localPhase={localPhase} billCountry={country} />
        )}
      </View>
    );
  }

  // --- Review state (items extracted) ---
  const renderDeleteAction = () => (
    <Animated.View className="flex-1 items-end justify-center bg-destructive pr-6">
      <IconSymbol name="xmark" size={18} color={iconColors.primaryForeground} />
      <Text className="mt-0.5 text-sm font-medium text-white">{t.delete}</Text>
    </Animated.View>
  );

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: insets.bottom }}
    >
      {/* Drag indicator */}
      <View className="items-center pt-3">
        <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </View>

      {/* Header */}
      <View className="px-7 pb-2 pt-2">
        <View>
          <View className="flex-row items-center justify-between">
            <Text className="text-3xl font-extrabold tracking-tight text-foreground">
              {t.scan_reviewTitle}
            </Text>
              <View className="flex-row items-center gap-2.5">
                <View className="rounded-full bg-primary/10 px-3 py-1">
                  <Text className="text-sm font-bold text-primary">
                    {t.scan_itemCount(bill.items.length)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setBill(null)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-70"
                >
                  <IconSymbol name="arrow.counterclockwise" size={16} color={iconColors.muted} />
                </Pressable>
              </View>
            </View>
          <Input
            value={bill.name}
            onChangeText={(text) => setBill({ ...bill, name: text })}
            className="mt-0.5 h-auto border-0 bg-transparent px-0 py-0 text-base text-muted-foreground shadow-none"
            placeholder={t.scan_restaurantPlaceholder}
            placeholderTextColor={iconColors.mutedLight}


          />
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
      >
        {/* Hint */}
        <Text className="mb-1 px-7 text-sm text-muted-foreground">
          {t.scan_tapToEdit}
        </Text>

        {/* Items list — flat rows, no card wrapper */}
        {bill.items.map((item, index) => (
          <SwipeableItem key={item.id} isDeleting={deletingIndex === index}>
          <ReanimatedSwipeable
            renderRightActions={renderDeleteAction}
            rightThreshold={80}
            overshootRight
            onSwipeableOpen={() => handleRemoveItem(index)}
            onSwipeableOpenStartDrag={() => { swipeOpenRef.current = true; }}
          >
            {editingIndex === index ? (
              /* Expanded edit mode */
              <View className="border-l-2 border-l-primary bg-primary/5 px-7 py-3.5">
                <View className="mb-3 flex-row items-center justify-between">
                  <Input
                    value={item.name}
                    onChangeText={(text) => updateItem(index, 'name', text)}
                    className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-lg font-semibold shadow-none"
                    placeholder={t.scan_itemName}
                    placeholderTextColor={iconColors.mutedLight}
                    autoFocus
                  />
                  <Pressable
                    onPress={() => setEditingIndex(null)}
                    className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
                  >
                    <Text className="text-sm font-semibold text-destructive">{t.cancel}</Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
                    <Input
                      value={String(item.quantity)}
                      onChangeText={(text) => updateItem(index, 'quantity', text)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-base font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
                    <Input
                      value={formatCurrency(item.unitPrice, country)}
                      onChangeText={(text) => updateItem(index, 'unitPrice', text)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-base font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
                    <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                      <Text className="text-base font-bold text-primary">
                        {formatCurrency(item.subtotal, country)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => setEditingIndex(null)}
                  className="mt-3 items-center rounded-lg bg-primary/10 py-2"
                >
                  <Text className="text-base font-semibold text-primary">{t.done}</Text>
                </Pressable>
              </View>
            ) : (
              /* Compact display row */
              <View className="bg-background">
                <Pressable
                  onPress={() => handleItemPress(index)}
                  className="flex-row items-center px-7 py-3 active:bg-muted/30"
                >
                  <View className="mr-3 flex-1">
                    <Text
                      className="text-lg font-semibold leading-5 text-foreground"
                      numberOfLines={1}
                    >
                      {item.name || t.scan_unnamed}
                    </Text>
                    <Text className="mt-0.5 text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unitPrice, country)}
                    </Text>
                  </View>
                  <Text className="mr-1.5 text-lg font-bold tabular-nums text-foreground">
                    {formatCurrency(item.subtotal, country)}
                  </Text>
                  <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
                </Pressable>
                {/* Divider */}
                {index < bill.items.length - 1 && (
                  <View className="ml-7 h-px bg-border/40" />
                )}
              </View>
            )}
          </ReanimatedSwipeable>
          </SwipeableItem>
        ))}

        {/* Add Item */}
        <Pressable
          onPress={handleAddItem}
          className="flex-row items-center justify-center gap-2 py-4 active:bg-muted/30"
        >
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary/15">
            <IconSymbol name="plus" size={12} color={iconColors.primary} />
          </View>
          <Text className="text-base font-semibold text-primary">{t.scan_addItem}</Text>
        </Pressable>

        {/* Divider before summary */}
        <View className="mx-7 h-px bg-border/40" />

        {/* Summary — flat rows, no card */}
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-base text-muted-foreground">{t.scan_subtotal}</Text>
          <Text className="text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(bill.items.reduce((total, item) => total + item.subtotal, 0), country)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-base text-foreground">{t.scan_taxIva}</Text>
          <Input
            value={formatCurrency(bill.tax, country)}
            onChangeText={(text) => setBill({ ...bill, tax: parseCurrency(text, country) })}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-base font-semibold tabular-nums shadow-none"
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-base text-foreground">{t.scan_tipPropina}</Text>
          <Input
            value={bill.tip === 0 ? '' : formatCurrency(bill.tip, country)}
            onChangeText={(text) => setBill({ ...bill, tip: parseCurrency(text, country) })}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-base font-semibold tabular-nums shadow-none"
            placeholder="$0"
            placeholderTextColor={iconColors.mutedLight}
            keyboardType="number-pad"
          />
        </View>

        {/* Total */}
        <View className="mx-7 h-px bg-border/40" />
        <View className="flex-row items-center justify-between px-7 py-4">
          <View>
            <Text className="text-base font-bold text-foreground">{t.scan_total}</Text>
            {bill.total > 0 && bill.total !== calculatedTotal && (
              <Text className="mt-0.5 text-sm text-muted-foreground">
                Bill: {formatCurrency(bill.total, country)}
              </Text>
            )}
          </View>
          <Text className="text-3xl font-extrabold tracking-tight text-primary">
            {formatCurrency(calculatedTotal, country)}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Confirm Button */}
      <View className="border-t border-border/30 px-7 pb-2 pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">{t.scan_total}</Text>
          <Text className="text-lg font-bold text-primary">{formatCurrency(calculatedTotal, country)}</Text>
        </View>
        <Button
          variant="default"
          size="lg"
          className="w-full rounded-xl"
          disabled={isSaving || bill.items.length === 0}
          onPress={handleConfirm}
        >
          {isSaving ? (
            <>
              <ActivityIndicator size="small" color={iconColors.primaryForeground} />
              <Text>{t.scan_saving}</Text>
            </>
          ) : (
            <>
              <IconSymbol name="checkmark" size={18} color={iconColors.primaryForeground} />
              <Text>{t.scan_confirmItems}</Text>
            </>
          )}
        </Button>
      </View>

      <KeyboardDoneButton />
    </View>
  );
}

