import { useState, useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useQuery } from 'convex/react';
import type { Doc } from '@/convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';

type Bill = Doc<'bills'>;

type BillState = 'unsplit' | 'split' | 'unresolved';

const STATE_CONFIG: Record<BillState, { label: string; dot: string; bg: string; text: string }> = {
  unsplit: {
    label: 'Unsplit',
    dot: 'bg-state-unsplit dark:bg-dark-state-unsplit',
    bg: 'bg-state-unsplit-bg dark:bg-dark-state-unsplit-bg',
    text: 'text-muted-foreground dark:text-dark-muted-fg',
  },
  split: {
    label: 'Split',
    dot: 'bg-state-split dark:bg-dark-state-split',
    bg: 'bg-state-split-bg dark:bg-dark-state-split-bg',
    text: 'text-state-split dark:text-dark-state-split',
  },
  unresolved: {
    label: 'Unresolved',
    dot: 'bg-state-unresolved dark:bg-dark-state-unresolved',
    bg: 'bg-state-unresolved-bg dark:bg-dark-state-unresolved-bg',
    text: 'text-state-unresolved dark:text-dark-state-unresolved',
  },
};

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function StateBadge({ state }: { state: BillState }) {
  const config = STATE_CONFIG[state];
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${config.bg}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <Text className={`text-xs font-medium ${config.text}`}>{config.label}</Text>
    </View>
  );
}

function BillCard({
  bill,
  iconColors,
  onPress,
}: {
  bill: Bill;
  iconColors: typeof ICON_COLORS.light;
  onPress: () => void;
}) {
  const date = new Date(bill._creationTime);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const contactCount = bill.contacts.length;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-card p-4 active:scale-[0.98] dark:border-dark-border dark:bg-dark-card"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-foreground dark:text-dark-fg">{bill.name}</Text>
          <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">{dateStr}</Text>
        </View>
        <StateBadge state={bill.state} />
      </View>

      <View className="mt-4 flex-row items-end justify-between">
        <Text className="text-2xl font-bold tracking-tight text-foreground dark:text-dark-fg">
          {formatCOP(bill.total)}
        </Text>
        {contactCount > 0 && (
          <View className="flex-row items-center gap-1">
            <IconSymbol name="person.crop.circle" size={14} color={iconColors.muted} />
            <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">
              {contactCount} {contactCount === 1 ? 'person' : 'people'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-2 ${
        active
          ? 'bg-primary dark:bg-dark-primary'
          : 'border border-border bg-card dark:border-dark-border dark:bg-dark-card'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active
            ? 'text-primary-foreground dark:text-dark-primary-fg'
            : 'text-muted-foreground dark:text-dark-muted-fg'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<BillState | 'all'>('all');

  const bills = useQuery(api.bills.list, user ? { userId: user.id } : 'skip');

  const filteredBills =
    activeFilter === 'all'
      ? bills ?? []
      : (bills ?? []).filter((b) => b.state === activeFilter);

  const totalAmount = filteredBills.reduce((sum, b) => sum + b.total, 0);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take photos of bills.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({ pathname: '/bills/new', params: { imageUri: result.assets[0].uri } } as Href);
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Photo library access is required to select bill photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({ pathname: '/bills/new', params: { imageUri: result.assets[0].uri } } as Href);
      }
    }
  }, [router]);

  const handleFABPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage('camera');
          if (buttonIndex === 2) pickImage('library');
        }
      );
    } else {
      Alert.alert('Add Bill', 'How would you like to add a bill?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Library', onPress: () => pickImage('library') },
      ]);
    }
  }, [pickImage]);

  const handleClearFilter = useCallback(() => {
    setActiveFilter('all');
  }, []);

  return (
    <View className="flex-1 bg-background dark:bg-dark-bg" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pb-2 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-extrabold tracking-tight text-foreground dark:text-dark-fg">
              Rondas
            </Text>
            <Text className="mt-0.5 text-sm text-muted-foreground dark:text-dark-muted-fg">
              {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'} · {formatCOP(totalAmount)}
            </Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-dark-primary/15">
            <IconSymbol name="receipt" size={20} color={iconColors.primary} />
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="px-5 py-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <FilterChip label="All" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
            <FilterChip label="Unsplit" active={activeFilter === 'unsplit'} onPress={() => setActiveFilter('unsplit')} />
            <FilterChip label="Split" active={activeFilter === 'split'} onPress={() => setActiveFilter('split')} />
            <FilterChip label="Unresolved" active={activeFilter === 'unresolved'} onPress={() => setActiveFilter('unresolved')} />
            {activeFilter !== 'all' && (
              <Pressable
                onPress={handleClearFilter}
                className="flex-row items-center gap-1 rounded-full border border-destructive/30 px-3 py-2"
              >
                <IconSymbol name="xmark" size={12} color="#ef4444" />
                <Text className="text-sm font-medium text-destructive">Clear</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Bill List */}
      {bills === undefined ? (
        // Loading state
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">Loading bills...</Text>
        </View>
      ) : filteredBills.length === 0 ? (
        // Empty state
        <View className="flex-1 items-center justify-center px-5">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted dark:bg-dark-muted">
            <IconSymbol name="receipt" size={28} color={iconColors.mutedLight} />
          </View>
          <Text className="text-lg font-semibold text-foreground dark:text-dark-fg">No bills found</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground dark:text-dark-muted-fg">
            Tap + to scan a new bill
          </Text>
        </View>
      ) : (
        <FlashList<Bill>
          data={filteredBills}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <BillCard
                bill={item}
                iconColors={iconColors}
                onPress={() => {
                  // TODO: navigate to bill detail
                }}
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <View className="absolute bottom-28 right-5" style={{ marginBottom: insets.bottom }}>
        <Pressable
          onPress={handleFABPress}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95 dark:bg-dark-primary dark:shadow-dark-primary/20"
        >
          <IconSymbol name="plus" size={28} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
        </Pressable>
      </View>
    </View>
  );
}
