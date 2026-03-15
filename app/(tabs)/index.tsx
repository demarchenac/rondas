import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';

type BillState = 'unsplit' | 'split' | 'unresolved';

interface Bill {
  id: string;
  name: string;
  date: string;
  total: number;
  state: BillState;
  contactCount: number;
}

const MOCK_BILLS: Bill[] = [
  { id: '1', name: 'Andrés Carne de Res', date: 'Mar 14', total: 285000, state: 'unresolved', contactCount: 4 },
  { id: '2', name: 'Crepes & Waffles', date: 'Mar 12', total: 142500, state: 'split', contactCount: 2 },
  { id: '3', name: 'El Cielo', date: 'Mar 10', total: 520000, state: 'split', contactCount: 6 },
  { id: '4', name: 'Wok', date: 'Mar 8', total: 96800, state: 'unsplit', contactCount: 0 },
  { id: '5', name: 'La Hamburguesería', date: 'Mar 5', total: 178000, state: 'unresolved', contactCount: 3 },
  { id: '6', name: 'Juan Valdez — Usaquén', date: 'Mar 3', total: 34500, state: 'split', contactCount: 2 },
];

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

function BillCard({ bill, iconColors }: { bill: Bill; iconColors: typeof ICON_COLORS.light }) {
  return (
    <Pressable className="rounded-2xl border border-border bg-card p-4 active:scale-[0.98] dark:border-dark-border dark:bg-dark-card">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-foreground dark:text-dark-fg">{bill.name}</Text>
          <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">{bill.date}</Text>
        </View>
        <StateBadge state={bill.state} />
      </View>

      <View className="mt-4 flex-row items-end justify-between">
        <Text className="text-2xl font-bold tracking-tight text-foreground dark:text-dark-fg">
          {formatCOP(bill.total)}
        </Text>
        {bill.contactCount > 0 && (
          <View className="flex-row items-center gap-1">
            <IconSymbol name="person.crop.circle" size={14} color={iconColors.muted} />
            <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">
              {bill.contactCount} {bill.contactCount === 1 ? 'person' : 'people'}
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
  const [activeFilter, setActiveFilter] = useState<BillState | 'all'>('all');

  const filteredBills =
    activeFilter === 'all'
      ? MOCK_BILLS
      : MOCK_BILLS.filter((b) => b.state === activeFilter);

  const totalAmount = filteredBills.reduce((sum, b) => sum + b.total, 0);

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
          </View>
        </ScrollView>
      </View>

      {/* Bill List */}
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="gap-3 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {filteredBills.map((bill) => (
          <BillCard key={bill.id} bill={bill} iconColors={iconColors} />
        ))}

        {filteredBills.length === 0 && (
          <View className="items-center justify-center py-20">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted dark:bg-dark-muted">
              <IconSymbol name="receipt" size={28} color={iconColors.mutedLight} />
            </View>
            <Text className="text-lg font-semibold text-foreground dark:text-dark-fg">No bills found</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground dark:text-dark-muted-fg">
              Tap + to scan a new bill
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <View className="absolute bottom-28 right-5" style={{ marginBottom: insets.bottom }}>
        <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95 dark:bg-dark-primary dark:shadow-dark-primary/20">
          <IconSymbol name="plus" size={28} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
        </Pressable>
      </View>
    </View>
  );
}
