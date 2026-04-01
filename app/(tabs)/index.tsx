import { useState, useCallback, useRef } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useMutation } from 'convex/react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Id } from '@/convex/_generated/dataModel';
import type { ResolvedBill } from '@/lib/filters';
import { defaultFilters } from '@/lib/filters';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';
import { formatCurrency } from '@/lib/format';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useT } from '@/lib/i18n';
import BillCard from '@/components/bills/BillCard';
import BillCardSkeleton from '@/components/bills/BillCardSkeleton';
import FilterChip from '@/components/bills/FilterChip';
import FilterSheet from '@/components/bills/FilterSheet';
import { useBillFilters } from '@/hooks/useBillFilters';

type Bill = ResolvedBill;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();

  const {
    activeFilters,
    setActiveFilters,
    filterSheetVisible,
    setFilterSheetVisible,
    filterOptions,
    bills,
    paginationStatus,
    loadMore,
    activeAdvancedFilterCount,
    userCountry,
  } = useBillFilters(user?.id);

  const billsByState = filterOptions?.billsByState;
  const activeBillCount = filterOptions?.activeBillCount ?? 0;
  const billContacts = filterOptions?.contacts ?? [];

  const removeBill = useMutation(api.bills.remove);
  const [refreshing, setRefreshing] = useState(false);

  // Track animated IDs to prevent re-animation on FlashList recycle
  const animatedIds = useRef(new Set<string>());

  const handleDeleteBill = useCallback((billId: Id<'bills'>) => {
    if (!user) return;
    Alert.alert(t.home_deleteBill, t.home_deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeBill({ id: billId, userId: user.id });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            console.error('[Home] removeBill failed:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t.error, t.error_mutationFailed);
          }
        },
      },
    ]);
  }, [removeBill, t, user]);

  const { country } = useSettingsStore();

  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const defaults = defaultFilters(userCountry);
  const hasActiveFilters =
    activeFilters.state !== 'all' ||
    activeAdvancedFilterCount > 0 ||
    activeFilters.country !== defaults.country;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pb-1 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-extrabold tracking-tight text-foreground">
              {t.home_greeting(firstName)}
            </Text>
            <View className="mt-1 flex-row items-center gap-3">
              <Text className="text-xs text-muted-foreground">
                {t.home_billCount(activeBillCount)}
              </Text>
              {bills.length > 0 && (
                <Text className="text-xs font-semibold text-foreground">
                  {formatCurrency(bills.reduce((sum, b) => sum + b.total, 0), country)}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings' as Href)}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary/10"
          >
            <Text className="text-base font-bold text-primary">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="px-5 py-2.5">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {/* Country chips */}
            <FilterChip label="🇨🇴 CO" isActive={activeFilters.country === 'CO'} onPress={() => setActiveFilters((f) => ({ ...f, country: 'CO' }))} />
            <FilterChip label="🇺🇸 US" isActive={activeFilters.country === 'US'} onPress={() => setActiveFilters((f) => ({ ...f, country: 'US' }))} />

            {/* State chips */}
            <FilterChip label={t.filter_all} isActive={activeFilters.state === 'all'} onPress={() => setActiveFilters((f) => ({ ...f, state: 'all' }))} />
            {(billsByState?.draft ?? 0) > 0 && (
              <FilterChip label={t.filter_draft} isActive={activeFilters.state === 'draft'} onPress={() => setActiveFilters((f) => ({ ...f, state: 'draft' }))} count={billsByState?.draft} />
            )}
            <FilterChip label={t.filter_unsplit} isActive={activeFilters.state === 'unsplit'} onPress={() => setActiveFilters((f) => ({ ...f, state: 'unsplit' }))} count={billsByState?.unsplit} />
            <FilterChip label={t.filter_unresolved} isActive={activeFilters.state === 'unresolved'} onPress={() => setActiveFilters((f) => ({ ...f, state: 'unresolved' }))} count={billsByState?.unresolved} />
            <FilterChip label={t.filter_split} isActive={activeFilters.state === 'split'} onPress={() => setActiveFilters((f) => ({ ...f, state: 'split' }))} count={billsByState?.split} />

            {/* Advanced filters button */}
            <FilterChip
              label={t.filter_filters}
              isActive={activeAdvancedFilterCount > 0}
              count={activeAdvancedFilterCount > 0 ? activeAdvancedFilterCount : undefined}
              onPress={() => setFilterSheetVisible(true)}
              icon={<IconSymbol name="line.3.horizontal.decrease" size={12} color={activeAdvancedFilterCount > 0 ? iconColors.primaryForeground : iconColors.muted} />}
            />

            {/* Clear all */}
            {hasActiveFilters && (
              <Pressable
                onPress={() => setActiveFilters(defaultFilters(userCountry))}
                className="items-center justify-center rounded-full px-2 py-1.5"
              >
                <IconSymbol name="xmark.circle.fill" size={18} color={iconColors.destructive} />
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Bill List */}
      {paginationStatus === 'LoadingFirstPage' ? (
        <View className="flex-1 px-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(i * 100).duration(300)}
              className="py-1"
            >
              <BillCardSkeleton />
            </Animated.View>
          ))}
        </View>
      ) : bills.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/[0.08]">
            <IconSymbol name="receipt" size={32} color={iconColors.primary} />
          </View>
          <Text className="text-lg font-bold text-foreground">{t.home_noBills}</Text>
          <Text className="mt-1.5 text-center text-sm text-muted-foreground">
            {t.home_noBillsHint}
          </Text>
          <Text className="mt-3 text-center text-xs text-muted-foreground">
            {t.home_addFirstBill}
          </Text>
        </View>
      ) : (
        <FlashList<Bill>
          data={bills}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => {
            const shouldAnimate = !animatedIds.current.has(item._id);
            if (shouldAnimate) animatedIds.current.add(item._id);

            return (
              <Animated.View
                entering={shouldAnimate ? FadeInDown.delay(Math.min(index, 8) * 60).duration(350) : undefined}
                className="px-5 py-[3px]"
              >
                <Swipeable
                  renderRightActions={() => (
                    <Pressable
                      onPress={() => handleDeleteBill(item._id)}
                      className="ml-2 w-20 items-center justify-center rounded-xl bg-destructive"
                    >
                      <IconSymbol name="xmark" size={18} color={iconColors.primaryForeground} />
                      <Text className="mt-0.5 text-[10px] font-medium text-white">{t.delete}</Text>
                    </Pressable>
                  )}
                  rightThreshold={80}
                  overshootRight={false}
                >
                  <BillCard
                    bill={item}
                    onPress={() => router.push(`/bills/${item._id}` as Href)}
                    t={t}
                  />
                </Swipeable>
              </Animated.View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 800);
              }}
              tintColor={iconColors.primary}
              colors={[iconColors.primary]}
            />
          }
          ListFooterComponent={
            paginationStatus === 'CanLoadMore' ? (
              <View className="items-center py-4">
                <Button variant="outline" onPress={() => loadMore(20)}>
                  <Text>{t.home_loadMore}</Text>
                </Button>
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        filters={activeFilters}
        billsByState={billsByState}
        activeBillCount={activeBillCount}
        availableContacts={billContacts}
        onApply={(f) => {
          setActiveFilters(f);
          setFilterSheetVisible(false);
        }}
        onClear={() => {
          setActiveFilters(defaultFilters(userCountry));
          setFilterSheetVisible(false);
        }}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}
