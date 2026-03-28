import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { useAction, useMutation } from 'convex/react';
import { randomUUID } from 'expo-crypto';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';
import { resolvePlace } from '@/lib/places';

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

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function parseCOP(text: string): number {
  return Math.round(Number(text.replace(/[^0-9]/g, '')) || 0);
}

function deduplicateItems(items: BillItem[]): BillItem[] {
  const grouped = new Map<string, BillItem>();

  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!key) continue;

    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.subtotal += item.subtotal;
    } else {
      grouped.set(key, { ...item });
    }
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    id: item.id || generateItemId(),
    name: item.name.trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    unitPrice: Math.round(item.subtotal / item.quantity),
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

  const extractItems = useAction(api.ai.extractBillItems);
  const createBill = useMutation(api.bills.create);

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
      'Discard changes?',
      'You have unsaved items. Leaving will discard your progress and you\'ll need to scan the bill again, which uses your available scans.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
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

      const result = await extractItems({ imageBase64: base64, mimeType: 'image/jpeg' });
      const dedupedItems = deduplicateItems(
        result.items.map((item) => ({ ...item, id: generateItemId() }))
      );
      const calculatedTotal = dedupedItems.reduce((sum, i) => sum + i.subtotal, 0) + (result.tax || 0) + (result.tip || 0);

      // Strip client IDs — server generates them
      const itemsForDB = dedupedItems.map(({ id: _id, ...rest }) => rest);

      // Create bill as draft in DB and navigate to detail
      const billId = await createBill({
        userId: user!.id,
        name: placeData.placeName || 'Bill',
        total: calculatedTotal,
        tax: result.tax,
        tip: result.tip,
        items: itemsForDB,
        ...metadataParams,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/bills/${billId}` as Href);
    } catch (err) {
      console.error('[Scan] Error:', err);
      setError(String(err));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string) => {
    if (!bill) return;
    const items = [...bill.items];
    if (field === 'name') {
      items[index] = { ...items[index], name: value };
    } else {
      const num = parseCOP(value);
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
      Alert.alert('Error', 'Failed to save bill. Please try again.');
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
          No image selected
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Text>Go Back</Text>
        </Button>
      </View>
    );
  }

  // --- Scan state (no items yet) ---
  if (!bill) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#121a2e' }}>
        {/* Full-screen image background */}
        <Image
          source={{ uri: imageUri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Drag indicator */}
        <View style={{ alignItems: 'center', paddingTop: 12, zIndex: 10 }}>
          <View
            style={{
              height: 4,
              width: 40,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.5)',
            }}
          />
        </View>

        {/* Bottom gradient + controls */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <LinearGradient
            colors={['transparent', 'rgba(18,26,46,0.85)', 'rgba(18,26,46,0.95)']}
            locations={[0, 0.5, 1]}
            style={{ paddingBottom: insets.bottom + 8, paddingHorizontal: 28, paddingTop: 100 }}
          >
            {/* Error toast */}
            {error && (
              <Pressable
                onPress={handleScan}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.25)',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>
                  {error}
                </Text>
                <Text style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center', marginTop: 4, fontWeight: '600' }}>
                  Tap to retry
                </Text>
              </Pressable>
            )}

            {/* Scan button — glass with primary tint */}
            {!scanning && (
              <>
                <Pressable
                  onPress={handleScan}
                  style={{
                    overflow: 'hidden',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                  }}
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
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
                      Scan Bill
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
                  style={{ alignItems: 'center', paddingVertical: 16 }}
                >
                  <Text style={{ color: '#8b9cc0', fontSize: 14, fontWeight: '500' }}>
                    Enter Manually
                  </Text>
                </Pressable>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Scanning overlay */}
        {scanning && (
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(18,26,46,0.7)',
              }}
            />
            <View style={{ alignItems: 'center', zIndex: 1 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(56, 189, 248, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator size="large" color="#38bdf8" />
              </View>
              <Text style={{ color: '#e8ecf4', fontSize: 17, fontWeight: '700', marginTop: 20 }}>
                Analyzing bill...
              </Text>
              <Text style={{ color: '#8b9cc0', fontSize: 13, marginTop: 6 }}>
                This may take a few seconds
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // --- Review state (items extracted) ---
  const renderDeleteAction = () => (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 24,
      }}
    >
      <IconSymbol name="xmark" size={18} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '500', marginTop: 2 }}>Delete</Text>
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
              Review Items
            </Text>
              <View className="flex-row items-center gap-2.5">
                <View className="rounded-full bg-primary/10 px-3 py-1">
                  <Text className="text-xs font-bold text-primary">
                    {bill.items.length} items
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
            placeholder="Restaurant name..."
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
          Tap to edit · Swipe left to delete
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
                    placeholder="Item name"
                    placeholderTextColor={iconColors.mutedLight}
                    autoFocus
                  />
                  <Pressable
                    onPress={() => setEditingIndex(null)}
                    className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
                  >
                    <Text className="text-xs font-semibold text-destructive">Cancel</Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Qty</Text>
                    <Input
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem(index, 'quantity', v)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unit Price</Text>
                    <Input
                      value={formatCOP(item.unitPrice)}
                      onChangeText={(v) => updateItem(index, 'unitPrice', v)}
                      className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Subtotal</Text>
                    <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                      <Text className="text-sm font-bold text-primary">
                        {formatCOP(item.subtotal)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => setEditingIndex(null)}
                  className="mt-3 items-center rounded-lg bg-primary/10 py-2"
                >
                  <Text className="text-sm font-semibold text-primary">Done</Text>
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
                      {item.name || 'Unnamed item'}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {item.quantity} × {formatCOP(item.unitPrice)}
                    </Text>
                  </View>
                  <Text className="mr-1.5 text-[15px] font-bold tabular-nums text-foreground">
                    {formatCOP(item.subtotal)}
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
          <Text className="text-sm font-semibold text-primary">Add Item</Text>
        </Pressable>

        {/* Divider before summary */}
        <View className="mx-7 h-px bg-border/40" />

        {/* Summary — flat rows, no card */}
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-muted-foreground">Subtotal</Text>
          <Text className="text-sm font-semibold tabular-nums text-foreground">
            {formatCOP(bill.items.reduce((sum, i) => sum + i.subtotal, 0))}
          </Text>
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">Tax (IVA)</Text>
          <Input
            value={formatCOP(bill.tax)}
            onChangeText={(v) => setBill({ ...bill, tax: parseCOP(v) })}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">Tip (Propina)</Text>
          <Input
            value={bill.tip === 0 ? '' : formatCOP(bill.tip)}
            onChangeText={(v) => setBill({ ...bill, tip: parseCOP(v) })}
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
            <Text className="text-sm font-bold text-foreground">Total</Text>
            {bill.total > 0 && bill.total !== calculatedTotal && (
              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                Bill: {formatCOP(bill.total)}
              </Text>
            )}
          </View>
          <Text className="text-2xl font-extrabold tracking-tight text-primary">
            {formatCOP(calculatedTotal)}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Confirm Button */}
      <View className="border-t border-border/30 px-7 pb-2 pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">Total</Text>
          <Text className="text-base font-bold text-primary">{formatCOP(calculatedTotal)}</Text>
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
              <Text>Saving...</Text>
            </>
          ) : (
            <>
              <IconSymbol name="checkmark" size={18} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
              <Text>Confirm Items</Text>
            </>
          )}
        </Button>
      </View>

      <KeyboardDoneButton />
    </View>
  );
}

function SwipeableItem({ children, isDeleting }: { children: React.ReactNode; isDeleting: boolean }) {
  const height = useSharedValue<number | null>(null);
  const animatedStyle = useAnimatedStyle(() => {
    if (!isDeleting || height.value === null) return {};
    return {
      height: withTiming(0, { duration: 300 }),
      opacity: withTiming(0, { duration: 200 }),
      overflow: 'hidden' as const,
    };
  }, [isDeleting]);

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(e) => {
        if (height.value === null) {
          height.value = e.nativeEvent.layout.height;
        }
      }}
    >
      {children}
    </Animated.View>
  );
}

function KeyboardDoneButton() {
  const height = useSharedValue(0);

  const opening = useSharedValue(false);

  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      opening.value = e.height > 0;
    },
    onMove: (e) => {
      'worklet';
      height.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      height.value = e.height;
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: height.value,
    opacity: opening.value ? 1 : 0,
    pointerEvents: opening.value ? 'auto' as const : 'none' as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: '#1a2540',
          borderTopWidth: 1,
          borderTopColor: '#263354',
        }}
      >
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#38bdf8' }}>Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
