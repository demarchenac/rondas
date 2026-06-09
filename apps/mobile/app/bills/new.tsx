import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View , useColorScheme } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride } from '@/constants/taxes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatCurrency, parseCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';
import KeyboardDoneButton from '@/components/bills/KeyboardDoneButton';
import { useProGate } from '@/hooks/useProGate';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { useLocationResolver } from '@/hooks/useLocationResolver';
import { posthog } from '@/lib/posthog';
import ScanPreview from '@/components/bills/scan/ScanPreview';
import ReviewItemRow from '@/components/bills/scan/ReviewItemRow';
import ReviewSummary from '@/components/bills/scan/ReviewSummary';
import type { BillItem, ScanError, ScanPhase } from '@/lib/types';

function prepareItems(items: BillItem[]): BillItem[] {
  return items
    .filter((item) => item.name.trim() !== '')
    .map((item) => ({
      ...item,
      id: item.id || randomUUID(),
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
  const colorScheme = useColorScheme();
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
  const scanProgress = useQuery(api.scans.getScan, scanId && user ? { id: scanId } : 'skip');

  const placeData = useLocationResolver(resolveLocation, latitude, longitude);

  const metadataParams = useMemo(() => ({
    ...(photoTakenAt ? { photoTakenAt } : {}),
    ...(placeData.latitude && placeData.longitude ? {
      location: {
        latitude: placeData.latitude,
        longitude: placeData.longitude,
        ...(placeData.address ? { address: placeData.address } : {}),
      },
    } : {}),
  }), [photoTakenAt, placeData.latitude, placeData.longitude, placeData.address]);

  function classifyScanError(err: unknown): ScanError {
    const code = getErrorCode(err);
    const errorMessage = getErrorMessage(err).toLowerCase();
    if (code === 'NOT_A_RECEIPT' || errorMessage.includes('not_a_receipt')) return { type: 'not_a_receipt', message: t.error_notReceipt, hint: t.error_hintNotReceipt };
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) return { type: 'timeout', message: t.error_timeout, hint: t.error_hintTimeout };
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) return { type: 'api', message: t.error_rateLimited, hint: t.error_hintRateLimited };
    if (errorMessage.includes('403')) return { type: 'api', message: t.error_serviceUnavailable, hint: t.error_hintServiceUnavailable };
    if (errorMessage.includes('500') || errorMessage.includes('503')) return { type: 'api', message: t.error_api, hint: t.error_hintApi };
    if (errorMessage.includes('failed to parse')) return { type: 'generic', message: t.error_parseError, hint: t.error_hintParseError };
    return { type: 'generic', message: t.error_scanGeneric, hint: t.error_hintScan };
  }

  const [isScanning, setScanning] = useState(false);
  const [localPhase, setLocalPhase] = useState<ScanPhase>('uploading');
  const [isSaving, setSaving] = useState(false);
  const [bill, setBill] = useState<{ name?: string; items: BillItem[]; tax: number; tip: number; total: number } | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const swipeOpenRef = useRef(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const navigation = useNavigation();

  useEffect(() => {
    if (!bill) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      alert(t.scan_discardTitle, t.scan_discardMessage, [
        { text: t.scan_keepEditing, style: 'cancel' },
        { text: t.scan_discard, style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, bill, t, alert]);

  const handleItemPress = useCallback((index: number) => {
    if (swipeOpenRef.current) { swipeOpenRef.current = false; return; }
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
      const [compressed] = await Promise.all([
        manipulateAsync(imageUri, [{ resize: { width: 800 } }], { compress: 0.6, format: SaveFormat.JPEG }),
        minPhaseDelay(),
      ]);

      const file = new ExpoFile(compressed.uri);
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);

      setLocalPhase('analyzing');
      const newScanId = await createScan({});
      setScanId(newScanId);

      const result = await extractItems({ imageBase64: base64, mimeType: 'image/jpeg', scanId: newScanId, isPro });
      setLocalPhase('complete');

      const createBillAsync = async () => {
        const preparedItems = prepareItems(result.items.map((item) => ({ ...item, id: randomUUID() })));
        const { country, defaultTipPercent, impoconsumoIncluded, ivaIncluded } = useSettingsStore.getState();
        const category = result.category || 'dining';
        const itemsTotal = preparedItems.reduce((total, item) => total + item.subtotal, 0);
        const rawTaxConfig = getTaxConfig(country, category);
        const taxIncludedOverride = country === 'CO' ? (category === 'dining' ? impoconsumoIncluded : ivaIncluded) : undefined;
        const taxConfig = withTaxIncludedOverride(rawTaxConfig, taxIncludedOverride);
        const base = computeBase(itemsTotal, taxConfig);
        const tax = computeTax(itemsTotal, taxConfig);
        const tip = base * (defaultTipPercent / 100);
        return createBill({
          name: placeData.placeName || 'Bill',
          total: base + tax + tip,
          tax, tip,
          tipPercent: defaultTipPercent,
          items: preparedItems.map(({ id: _id, ...rest }) => rest),
          category, country, taxIncludedOverride,
          decimalPlaces: result.decimalPlaces,
          isPro,
          ...metadataParams,
        });
      };

      const [billId] = await Promise.all([createBillAsync(), new Promise<void>((r) => setTimeout(r, 800))]);

      if (newScanId) deleteScan({ id: newScanId }).catch((err) => { console.warn('[NewBill] mutation failed:', err); Sentry.captureException(err, { tags: { feature: 'new_bill' } }); });
      posthog.capture('bill_scan_succeeded', { item_count: result.items.length, category: result.category ?? 'dining', country, has_location: !!placeData.latitude });
      posthog.capture('bill_created', { creation_method: 'scan', item_count: result.items.length, country, is_pro: isPro });
      setScanAttempts(0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bills/${billId}` as Href);
    } catch (err) {
      console.error('[Scan] Error:', err);
      const classified = classifyScanError(err);
      Sentry.captureException(err, { tags: { feature: 'bill_scan', errorType: classified.type }, extra: { scanId, attempts: scanAttempts + 1 } });
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
    if (field === 'name') { items[index] = { ...items[index], name: value }; setBill({ ...bill, items }); return; }
    const num = parseCurrency(value, country);
    items[index] = { ...items[index], [field]: num };
    if (field === 'quantity' || field === 'unitPrice') items[index].subtotal = items[index].quantity * items[index].unitPrice;
    setBill({ ...bill, items });
  };

  const handleRemoveItem = (index: number) => {
    if (!bill) return;
    const snapshot = { ...bill, items: [...bill.items] };
    setDeletingIndex(index);
    setTimeout(() => { setBill({ ...snapshot, items: snapshot.items.filter((_, i) => i !== index) }); setDeletingIndex(null); }, 300);
  };

  const handleAddItem = () => {
    if (!bill) return;
    setBill({ ...bill, items: [...bill.items, { id: randomUUID(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 }] });
  };

  const calculatedTotal = bill ? bill.items.reduce((total, item) => total + item.subtotal, 0) + bill.tax + bill.tip : 0;

  const handleConfirm = async () => {
    if (!bill || !user) return;
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const savedItems = bill.items.filter((item) => item.name.trim() !== '');
      await createBill({ name: bill.name || 'Bill', total: calculatedTotal, tax: bill.tax, tip: bill.tip, items: savedItems, isPro });
      posthog.capture('bill_created', { creation_method: 'manual', item_count: savedItems.length, country, is_pro: isPro });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBill(null);
      router.replace('/(tabs)' as Href);
    } catch (err) {
      console.error('[Save] Error:', err);
      Sentry.captureException(err, { tags: { feature: 'new_bill' } });
      alert(t.error, t.scan_saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleManualEntry = useCallback(async () => {
    if (!user) return;
    posthog.capture('bill_manual_entry_started');
    const billId = await createBill({ name: placeData.placeName || 'Bill', total: 0, items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }], ...metadataParams });
    router.replace(`/bills/${billId}` as Href);
  }, [user, createBill, placeData.placeName, metadataParams, router]);

  const handleManualEntryFromError = useCallback(async () => {
    if (!user) return;
    const billId = await createBill({ name: placeData.placeName || 'Bill', total: 0, items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }], isPro, ...metadataParams });
    router.replace(`/bills/${billId}` as Href);
  }, [user, createBill, placeData.placeName, isPro, metadataParams, router]);

  if (!imageUri) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-xl font-semibold text-foreground">{t.scan_noImage}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Text>{t.back}</Text>
        </Button>
      </View>
    );
  }

  if (!bill) {
    return (
      <ScanPreview
        imageUri={imageUri}
        isScanning={isScanning}
        error={error}
        scanAttempts={scanAttempts}
        scanProgress={scanProgress}
        localPhase={localPhase}
        billCountry={country}
        bottomInset={insets.bottom}
        iconColors={iconColors}
        t={t}
        onScan={handleScan}
        onRetry={handleScan}
        onGoBack={() => router.back()}
        onManualEntry={handleManualEntry}
        onManualEntryFromError={handleManualEntryFromError}
      />
    );
  }

  const subtotal = bill.items.reduce((total, item) => total + item.subtotal, 0);

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <View className="items-center pt-3">
        <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </View>

      <View className="px-7 pb-2 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-extrabold tracking-tight text-foreground">{t.scan_reviewTitle}</Text>
          <View className="flex-row items-center gap-2.5">
            <View className="rounded-full bg-primary/10 px-3 py-1">
              <Text className="text-sm font-bold text-primary">{t.scan_itemCount(bill.items.length)}</Text>
            </View>
            <Pressable onPress={() => setBill(null)} className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-70">
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

      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={80}>
        <Text className="mb-1 px-7 text-sm text-muted-foreground">{t.scan_tapToEdit}</Text>

        {bill.items.map((item, index) => (
          <ReviewItemRow
            key={item.id}
            item={item}
            index={index}
            isEditing={editingIndex === index}
            isDeleting={deletingIndex === index}
            isLast={index === bill.items.length - 1}
            country={country}
            iconColors={iconColors}
            t={t}
            onPress={handleItemPress}
            onDismissEdit={() => setEditingIndex(null)}
            onRemove={handleRemoveItem}
            onUpdateField={updateItem}
          />
        ))}

        <Pressable onPress={handleAddItem} className="flex-row items-center justify-center gap-2 py-4 active:bg-muted/30">
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary/15">
            <IconSymbol name="plus" size={12} color={iconColors.primary} />
          </View>
          <Text className="text-base font-semibold text-primary">{t.scan_addItem}</Text>
        </Pressable>

        <ReviewSummary
          subtotal={subtotal}
          tax={bill.tax}
          tip={bill.tip}
          total={calculatedTotal}
          billTotal={bill.total}
          country={country}
          iconColors={iconColors}
          t={t}
          onTaxChange={(v) => setBill({ ...bill, tax: v })}
          onTipChange={(v) => setBill({ ...bill, tip: v })}
        />
      </KeyboardAwareScrollView>

      <View className="border-t border-border/30 px-7 pb-2 pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">{t.scan_total}</Text>
          <Text className="text-lg font-bold text-primary">{formatCurrency(calculatedTotal, country)}</Text>
        </View>
        <Button variant="default" size="lg" className="w-full rounded-xl" disabled={isSaving || bill.items.length === 0} onPress={handleConfirm}>
          {isSaving ? (
            <><ActivityIndicator size="small" color={iconColors.primaryForeground} /><Text>{t.scan_saving}</Text></>
          ) : (
            <><IconSymbol name="checkmark" size={18} color={iconColors.primaryForeground} /><Text>{t.scan_confirmItems}</Text></>
          )}
        </Button>
      </View>

      <KeyboardDoneButton />
    </View>
  );
}
