import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from '@react-navigation/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Swipeable } from 'react-native-gesture-handler';
import { useAction, useMutation, useQuery } from 'convex/react';
import { randomUUID } from 'expo-crypto';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';
import { resolvePlace } from '@/lib/places';
import { computeBase, computeTax, getTaxConfig } from '@/constants/taxes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatCurrency, parseCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';
import SwipeableItem from '@/components/bills/SwipeableItem';
import KeyboardDoneButton from '@/components/bills/KeyboardDoneButton';

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

function getScanStatusLabel(
  status: string | undefined,
  t: ReturnType<typeof useT>,
  itemCount: number,
): { title: string; hint: string } {
  switch (status) {
    case 'thinking':
      return { title: t.scan_reading, hint: t.scan_readingHint };
    case 'extracting':
      return { title: t.scan_extracting, hint: t.scan_itemsFound(itemCount) };
    default:
      return { title: t.scan_analyzing, hint: t.scan_analyzeHint };
  }
}

function prepareItems(items: BillItem[]): BillItem[] {
  return items
    .filter((item) => item.name.trim() !== '')
    .map((item) => ({
      ...item,
      id: item.id || generateItemId(),
      name: item.name.trim().replace(/^\w/, (c) => c.toUpperCase()),
      unitPrice: item.quantity > 0 ? Math.round(item.subtotal / item.quantity) : item.subtotal,
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
  const [scanId, setScanId] = useState<string | null>(null);
  const scanProgress = useQuery(
    api.scans.getScan,
    scanId ? { id: scanId as any } : 'skip'
  );

  // Resolve place name in background
  const [placeData, setPlaceData] = useState<{
    placeName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }>({});

  useEffect(() => {
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
        } else if (resolveLocation === 'exif' && latitude && longitude) {
          // Library: resolve from EXIF GPS
          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);
          const place = await resolvePlace(lat, lng);
          if (cancelled) return;
          setPlaceData({
            latitude: lat,
            longitude: lng,
            placeName: place?.name,
            address: place?.address,
          });
        }
      } catch {}
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

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bill, setBill] = useState<ExtractedBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const swipeOpenRef = useRef(false);
  const navigation = useNavigation();

  // Prevent dismiss when bill data exists — shows confirmation alert
  usePreventRemove(!!bill, ({ data }) => {
    Alert.alert(
      t.scan_discardTitle,
      t.scan_discardMessage,
      [
        { text: t.scan_keepEditing, style: 'cancel' },
        {
          text: t.scan_discard,
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ]
    );
  });

  const handleItemPress = useCallback((index: number) => {
    // Don't open edit mode if a swipe just happened
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingIndex(index);
  }, []);

  const handleScan = async () => {
    if (!imageUri) return;
    setError(null);
    setScanning(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Resize and compress to reduce payload (~90% smaller)
      const compressed = await manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: SaveFormat.JPEG },
      );

      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const newScanId = await createScan({ userId: user!.id });
      setScanId(newScanId);

      const result = await extractItems({ imageBase64: base64, mimeType: 'image/jpeg', scanId: newScanId });
      const preparedItems = prepareItems(
        result.items.map((item) => ({ ...item, id: generateItemId() }))
      );

      const { country, defaultTipPercent } = useSettingsStore.getState();
      const category = result.category || 'dining';
      const itemsTotal = preparedItems.reduce((sum, i) => sum + i.subtotal, 0);
      const taxConfig = getTaxConfig(country, category);

      // Base: item prices without tax
      const base = computeBase(itemsTotal, taxConfig);

      // Tax: extracted from tax-inclusive prices for CO, from Gemini for US
      const tax = taxConfig.taxIncluded
        ? computeTax(itemsTotal, taxConfig)
        : (result.tax || 0);

      // Tip: computed on base (without tax)
      const tip = Math.round(base * (defaultTipPercent / 100));

      // Total: base + tax + tip
      const calculatedTotal = base + tax + tip;

      // Strip client IDs — server generates them
      const itemsForDB = preparedItems.map(({ id: _id, ...rest }) => rest);

      // Create bill as draft in DB and navigate to detail
      const billId = await createBill({
        userId: user!.id,
        name: placeData.placeName || 'Bill',
        total: calculatedTotal,
        tax,
        tip,
        tipPercent: defaultTipPercent,
        items: itemsForDB,
        category,
        country,
        ...metadataParams,
      });
      if (newScanId) deleteScan({ id: newScanId }).catch(() => {});
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bills/${billId}` as Href);
    } catch (err) {
      console.error('[Scan] Error:', err);
      setError(String(err));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScanning(false);
      setScanId(null);
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string) => {
    if (!bill) return;
    const items = [...bill.items];
    if (field === 'name') {
      items[index] = { ...items[index], name: value };
    } else {
      const num = parseCurrency(value);
      items[index] = { ...items[index], [field]: num };
      if (field === 'quantity' || field === 'unitPrice') {
        items[index].subtotal = items[index].quantity * items[index].unitPrice;
      }
    }
    setBill({ ...bill, items });
  };

  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const removeItem = (index: number) => {
    if (!bill) return;
    const snapshot = { ...bill, items: [...bill.items] };
    setDeletingIndex(index);
    setTimeout(() => {
      const items = snapshot.items.filter((_, i) => i !== index);
      setBill({ ...snapshot, items });
      setDeletingIndex(null);
    }, 300);
  };

  const addItem = () => {
    if (!bill) return;
    setBill({
      ...bill,
      items: [...bill.items, { id: generateItemId(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
    });
  };

  const calculatedTotal = bill
    ? bill.items.reduce((sum, i) => sum + i.subtotal, 0) + bill.tax + bill.tip
    : 0;

  const handleConfirm = async () => {
    if (!bill || !user) return;
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await createBill({
        userId: user.id,
        name: bill.name || 'Bill',
        total: calculatedTotal,
        tax: bill.tax,
        tip: bill.tip,
        items: bill.items.filter((i) => i.name.trim() !== ''),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBill(null); // Clear bill so usePreventRemove allows navigation
      router.replace('/(tabs)' as Href);
    } catch (err) {
      console.error('[Save] Error:', err);
      Alert.alert(t.error, t.scan_saveError);
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
        <Text className="text-lg font-semibold text-foreground">
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
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
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
              <Pressable
                onPress={handleScan}
                className="mb-4 rounded-[14px] border border-destructive/25 bg-destructive/15 px-4 py-3"
              >
                <Text className="text-center text-[13px] text-red-300">
                  {error}
                </Text>
                <Text className="mt-1 text-center text-xs font-semibold text-red-300">
                  {t.scan_tapRetry}
                </Text>
              </Pressable>
            )}

            {/* Scan button — glass with primary tint */}
            {!scanning && (
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
                    <IconSymbol name="doc.text.viewfinder" size={22} color="#38bdf8" />
                    <Text className="text-[17px] font-semibold text-white">
                      {t.scan_scanBill}
                    </Text>
                  </BlurView>
                </Pressable>

                {/* Manual entry link */}
                <Pressable
                  onPress={async () => {
                    if (!user) return;
                    const billId = await createBill({
                      userId: user.id,
                      name: placeData.placeName || 'Bill',
                      total: 0,
                      items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
                      ...metadataParams,
                    });
                    router.replace(`/bills/${billId}` as Href);
                  }}
                  className="items-center py-4"
                >
                  <Text className="text-sm font-medium text-muted-foreground">
                    {t.scan_enterManually}
                  </Text>
                </Pressable>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Scanning overlay */}
        {scanning && (
          <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(18,26,46,0.7)',
              }}
            />
            <View className="z-[1] w-full items-center px-8">
              <View className="h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <ActivityIndicator size="large" color="#38bdf8" />
              </View>
              {(() => {
                const { title, hint } = getScanStatusLabel(
                  scanProgress?.status,
                  t,
                  scanProgress?.result?.items?.length ?? 0,
                );
                return (
                  <>
                    <Text className="mt-5 text-[17px] font-bold text-foreground">
                      {title}
                    </Text>
                    <Text className="mt-1.5 text-[13px] text-muted-foreground">
                      {hint}
                    </Text>
                  </>
                );
              })()}
              {/* Stream items as they arrive */}
              {scanProgress?.result?.items && scanProgress.result.items.length > 0 && (
                <View className="mt-5 max-h-[200px] w-full">
                  {scanProgress.result.items.map((item, i) => (
                    <View
                      key={i}
                      className={cn(
                        'flex-row justify-between py-1.5',
                        i < scanProgress.result!.items.length - 1 && 'border-b border-white/[0.08]',
                      )}
                    >
                      <Text className="flex-1 text-[13px] text-foreground" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text className="ml-3 text-[13px] font-semibold text-primary">
                        {formatCurrency(item.subtotal, country)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  // --- Review state (items extracted) ---
  const renderDeleteAction = () => (
    <Animated.View className="flex-1 items-end justify-center bg-destructive pr-6">
      <IconSymbol name="xmark" size={18} color="#fff" />
      <Text className="mt-0.5 text-[10px] font-medium text-white">Delete</Text>
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
            <Text className="text-2xl font-extrabold tracking-tight text-foreground">
              {t.scan_reviewTitle}
            </Text>
              <View className="flex-row items-center gap-2.5">
                <View className="rounded-full bg-primary/10 px-3 py-1">
                  <Text className="text-xs font-bold text-primary">
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
            className="mt-0.5 h-auto border-0 bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none"
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
        <Text className="mb-1 px-7 text-xs text-muted-foreground">
          {t.scan_tapToEdit}
        </Text>

        {/* Items list — flat rows, no card wrapper */}
        {bill.items.map((item, index) => (
          <SwipeableItem key={item.id} isDeleting={deletingIndex === index}>
          <Swipeable
            renderRightActions={renderDeleteAction}
            rightThreshold={80}
            overshootRight
            onSwipeableOpen={() => removeItem(index)}
            onSwipeableOpenStartDrag={() => { swipeOpenRef.current = true; }}
          >
            {editingIndex === index ? (
              /* Expanded edit mode */
              <View className="border-l-2 border-l-primary bg-primary/5 px-7 py-3.5">
                <View className="mb-3 flex-row items-center justify-between">
                  <Input
                    value={item.name}
                    onChangeText={(v) => updateItem(index, 'name', v)}
                    className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] font-semibold shadow-none"
                    placeholder={t.scan_itemName}
                    placeholderTextColor={iconColors.mutedLight}
                    autoFocus
                  />
                  <Pressable
                    onPress={() => setEditingIndex(null)}
                    className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
                  >
                    <Text className="text-xs font-semibold text-destructive">{t.cancel}</Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
                    <Input
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem(index, 'quantity', v)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
                    <Input
                      value={formatCurrency(item.unitPrice, country)}
                      onChangeText={(v) => updateItem(index, 'unitPrice', v)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
                    <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                      <Text className="text-sm font-bold text-primary">
                        {formatCurrency(item.subtotal, country)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => setEditingIndex(null)}
                  className="mt-3 items-center rounded-lg bg-primary/10 py-2"
                >
                  <Text className="text-sm font-semibold text-primary">{t.done}</Text>
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
                      className="text-[15px] font-semibold leading-5 text-foreground"
                      numberOfLines={1}
                    >
                      {item.name || t.scan_unnamed}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unitPrice, country)}
                    </Text>
                  </View>
                  <Text className="mr-1.5 text-[15px] font-bold tabular-nums text-foreground">
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
          </Swipeable>
          </SwipeableItem>
        ))}

        {/* Add Item */}
        <Pressable
          onPress={addItem}
          className="flex-row items-center justify-center gap-2 py-4 active:bg-muted/30"
        >
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary/15">
            <IconSymbol name="plus" size={12} color={iconColors.primary} />
          </View>
          <Text className="text-sm font-semibold text-primary">{t.scan_addItem}</Text>
        </Pressable>

        {/* Divider before summary */}
        <View className="mx-7 h-px bg-border/40" />

        {/* Summary — flat rows, no card */}
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-muted-foreground">{t.scan_subtotal}</Text>
          <Text className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(bill.items.reduce((sum, i) => sum + i.subtotal, 0), country)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">{t.scan_taxIva}</Text>
          <Input
            value={formatCurrency(bill.tax, country)}
            onChangeText={(v) => setBill({ ...bill, tax: parseCurrency(v) })}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">{t.scan_tipPropina}</Text>
          <Input
            value={bill.tip === 0 ? '' : formatCurrency(bill.tip, country)}
            onChangeText={(v) => setBill({ ...bill, tip: parseCurrency(v) })}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            placeholder="$0"
            placeholderTextColor={iconColors.mutedLight}
            keyboardType="number-pad"
          />
        </View>

        {/* Total */}
        <View className="mx-7 h-px bg-border/40" />
        <View className="flex-row items-center justify-between px-7 py-4">
          <View>
            <Text className="text-sm font-bold text-foreground">{t.scan_total}</Text>
            {bill.total > 0 && bill.total !== calculatedTotal && (
              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                Bill: {formatCurrency(bill.total, country)}
              </Text>
            )}
          </View>
          <Text className="text-2xl font-extrabold tracking-tight text-primary">
            {formatCurrency(calculatedTotal, country)}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Confirm Button */}
      <View className="border-t border-border/30 px-7 pb-2 pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">{t.scan_total}</Text>
          <Text className="text-base font-bold text-primary">{formatCurrency(calculatedTotal, country)}</Text>
        </View>
        <Button
          variant="default"
          size="lg"
          className="w-full rounded-xl"
          disabled={saving || bill.items.length === 0}
          onPress={handleConfirm}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
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

