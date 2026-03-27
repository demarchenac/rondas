import { useCallback, useRef, useState } from 'react';
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
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from '@react-navigation/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Swipeable } from 'react-native-gesture-handler';
import { useAction, useMutation } from 'convex/react';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';

interface BillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ExtractedBill {
  name: string;
  items: BillItem[];
  tax: number;
  tip: number;
  total: number;
}

const MOCK_BILL: ExtractedBill = {
  name: 'Restaurante El Cielo',
  items: [
    { name: 'Albóndigas Arrabiata', quantity: 1, unitPrice: 44000, subtotal: 44000 },
    { name: 'Coca Cola Normal', quantity: 2, unitPrice: 9000, subtotal: 18000 },
    { name: 'Coca Cola Zero', quantity: 5, unitPrice: 9000, subtotal: 45000 },
    { name: 'Copa Sangría Tinto', quantity: 1, unitPrice: 16000, subtotal: 16000 },
    { name: 'Tommy Margarita', quantity: 1, unitPrice: 45000, subtotal: 45000 },
    { name: 'Éclair De Pistachos', quantity: 1, unitPrice: 25000, subtotal: 25000 },
    { name: 'Agua Sin Gas', quantity: 2, unitPrice: 9900, subtotal: 19800 },
    { name: 'Americano', quantity: 2, unitPrice: 10000, subtotal: 20000 },
  ],
  tax: 42560,
  tip: 0,
  total: 275360,
};

// Set to true to skip AI extraction and use mock data for UI testing
const USE_MOCK_DATA = true;

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function parseCOP(text: string): number {
  return Math.round(Number(text.replace(/[^0-9]/g, '')) || 0);
}

export default function NewBillScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { user } = useAuth();

  const extractItems = useAction(api.ai.extractBillItems);
  const createBill = useMutation(api.bills.create);

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
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 800));
        setBill({ ...MOCK_BILL });
      } else {
        // Resize and compress to reduce payload (~90% smaller)
        const compressed = await manipulateAsync(
          imageUri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG },
        );

        const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const result = await extractItems({ imageBase64: base64, mimeType: 'image/jpeg' });
        setBill(result);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const removeItem = (index: number) => {
    if (!bill) return;
    const items = bill.items.filter((_, i) => i !== index);
    setBill({ ...bill, items });
  };

  const addItem = () => {
    if (!bill) return;
    setBill({
      ...bill,
      items: [...bill.items, { name: '', quantity: 1, unitPrice: 0, subtotal: 0 }],
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
        name: bill.name,
        total: bill.total || calculatedTotal,
        tax: bill.tax,
        tip: bill.tip,
        items: bill.items.filter((i) => i.name.trim() !== ''),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      <View
        className="flex-1 bg-background"
        style={{ paddingBottom: insets.bottom }}
      >
        {/* Drag indicator */}
        <View className="items-center pb-2 pt-3">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center px-5 pb-8 pt-2"
          showsVerticalScrollIndicator={false}
        >
          {/* Image Preview */}
          <View className="w-full overflow-hidden rounded-2xl border border-border">
            <Image
              source={{ uri: imageUri }}
              className="h-80 w-full"
              resizeMode="contain"
            />
          </View>

          {/* Scan Button */}
          <Button
            variant="default"
            size="lg"
            className="mt-6 w-full"
            disabled={scanning}
            onPress={handleScan}
          >
            {scanning ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text>Scanning bill...</Text>
              </>
            ) : (
              <>
                <IconSymbol name="doc.text.viewfinder" size={20} color="#fff" />
                <Text>Scan Bill</Text>
              </>
            )}
          </Button>

          {/* Manual Entry */}
          <Button
            variant="outline"
            size="lg"
            className="mt-3 w-full"
            disabled={scanning}
            onPress={() =>
              setBill({ name: 'Bill', items: [{ name: '', quantity: 1, unitPrice: 0, subtotal: 0 }], tax: 0, tip: 0, total: 0 })
            }
          >
            <IconSymbol name="pencil" size={18} color={iconColors.primary} />
            <Text>Enter Manually</Text>
          </Button>

          {/* Error */}
          {error && (
            <View className="mt-4 w-full rounded-xl bg-destructive/10 px-4 py-3">
              <Text className="text-center text-sm text-destructive">
                {error}
              </Text>
              <Button variant="ghost" className="mt-2" onPress={handleScan}>
                <Text>Try Again</Text>
              </Button>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // --- Review state (items extracted) ---
  const renderDeleteAction = (index: number) => () => (
    <Pressable
      onPress={() => removeItem(index)}
      className="w-20 items-center justify-center bg-destructive"
    >
      <IconSymbol name="xmark" size={18} color="#fff" />
      <Text className="mt-1 text-[10px] font-medium text-white">Delete</Text>
    </Pressable>
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
          <Swipeable
            key={index}
            renderRightActions={renderDeleteAction(index)}
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
