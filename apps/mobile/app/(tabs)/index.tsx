import { useState, useCallback, useMemo } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import SwipeableRow from '@/components/bills/SwipeableRow';
import { useProGate, FREE_HISTORY_DAYS } from '@/hooks/useProGate';
import { useNewBillAction } from '@/hooks/useNewBillAction';
import { useMutation } from 'convex/react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Id } from '@convex/_generated/dataModel';
import type { ResolvedBill, SortOption } from '@/lib/filters';
import { defaultFilters } from '@/lib/filters';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from '@/lib/expo-image';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@convex/_generated/api';
import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride } from '@/constants/taxes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useT } from '@/lib/i18n';
import BillCard from '@/components/bills/BillCard';
import BillCardSkeleton from '@/components/bills/BillCardSkeleton';
import Skeleton from '@/components/ui/Skeleton';
import FilterChip from '@/components/bills/FilterChip';
import FilterSheet from '@/components/bills/FilterSheet';
import { useBillFilters } from '@/hooks/useBillFilters';
import { useContactSync } from '@/hooks/useContactSync';
import { useCustomAlert } from '@/components/ui/custom-alert';

type Bill = ResolvedBill;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  useContactSync(user?.id);
  const { alert } = useCustomAlert();

  const {
    activeFilters,
    setActiveFilters,
    filterSheetVisible,
    setFilterSheetVisible,
    filterOptions,
    bills,
    paginationStatus,
    loadMore,
    nonDefaultFilterCount,
    userCountry,
  } = useBillFilters(user?.id);

  const billsByState = filterOptions?.billsByState;
  const activeBillCount = filterOptions?.activeBillCount ?? 0;
  const billContacts = filterOptions?.contacts ?? [];
  const minTotal = filterOptions?.minTotal;
  const maxTotal = filterOptions?.maxTotal;

  const removeBill = useMutation(api.bills.remove);
  const [refreshing, setRefreshing] = useState(false);
  const { isPro, showPaywall } = useProGate();
  const [historyCutoff] = useState(() => Date.now() - FREE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const { country } = useSettingsStore();
  const { openNewBillSheet } = useNewBillAction();
  const glassAvailable = isGlassEffectAPIAvailable();

  const isLoading = paginationStatus === 'LoadingFirstPage';

  const handleDeleteBill = useCallback((billId: Id<'bills'>) => {
    if (!user) return;
    alert(t.home_deleteBill, t.home_deleteConfirm, [
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
            alert(t.error, t.error_mutationFailed);
          }
        },
      },
    ]);
  }, [removeBill, t, user, alert]);

  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const hasNonDefaultFilters = nonDefaultFilterCount > 0;

  // Build applied filter chips — always show all applied filters including defaults
  const defaults = defaultFilters(userCountry);
  const appliedFilterChips = useMemo(() => {
    const chips: { key: string; label: string; isDefault: boolean }[] = [];

    // Sort — only when non-default
    if (activeFilters.sort !== defaults.sort) {
      const sortLabels: Record<SortOption, string> = {
        newest: t.filter_sort_newest,
        oldest: t.filter_sort_oldest,
        highest: t.filter_sort_highest,
        lowest: t.filter_sort_lowest,
        updated: t.filter_sort_updated,
        name_asc: t.filter_sort_name_asc,
      };
      chips.push({ key: 'sort', label: `↕ ${sortLabels[activeFilters.sort]}`, isDefault: false });
    }

    // Country — always
    const countryLabels: Record<string, string> = { CO: '🇨🇴 CO', US: '🇺🇸 US', all: '🌐 Int' };
    chips.push({ key: 'country', label: countryLabels[activeFilters.country] ?? activeFilters.country, isDefault: activeFilters.country === defaults.country });

    // State — always
    const stateLabels: Record<string, string> = {
      all: t.filter_all, draft: t.filter_draft, unsplit: t.filter_unsplit,
      unresolved: t.filter_unresolved, split: t.filter_split,
    };
    chips.push({ key: 'state', label: stateLabels[activeFilters.state] ?? activeFilters.state, isDefault: activeFilters.state === defaults.state });

    // Contacts — if any selected
    if (activeFilters.contactIds.length > 0) {
      chips.push({ key: 'contacts', label: t.filter_contactCount(activeFilters.contactIds.length), isDefault: false });
    }

    // Amount — if min or max set
    if (activeFilters.minAmount != null && activeFilters.maxAmount != null) {
      chips.push({ key: 'amount', label: t.filter_amountRange(
        formatCurrency(activeFilters.minAmount, activeFilters.country),
        formatCurrency(activeFilters.maxAmount, activeFilters.country),
      ), isDefault: false });
    } else if (activeFilters.minAmount != null) {
      chips.push({ key: 'amount', label: t.filter_minAmount(formatCurrency(activeFilters.minAmount, activeFilters.country)), isDefault: false });
    } else if (activeFilters.maxAmount != null) {
      chips.push({ key: 'amount', label: t.filter_maxAmount(formatCurrency(activeFilters.maxAmount, activeFilters.country)), isDefault: false });
    }

    // Date — always
    if (activeFilters.datePreset === 'custom') {
      chips.push({ key: 'date', label: t.filter_customDates, isDefault: false });
    } else {
      const presetLabels: Record<string, string> = {
        '1h': '1h', '1d': '1d', '7d': '7d', '30d': '30d',
      };
      chips.push({ key: 'date', label: t.filter_last(presetLabels[activeFilters.datePreset] ?? activeFilters.datePreset), isDefault: activeFilters.datePreset === defaults.datePreset });
    }

    return chips;
  }, [activeFilters, defaults, t]);

  // Dismiss handlers — reset individual filter to its default
  const dismissFilter = useCallback((key: string) => {
    setActiveFilters((f) => {
      switch (key) {
        case 'sort': return { ...f, sort: defaults.sort };
        case 'country': return { ...f, country: defaults.country };
        case 'state': return { ...f, state: defaults.state };
        case 'contacts': return { ...f, contactIds: [] };
        case 'amount': return { ...f, minAmount: null, maxAmount: null };
        case 'date': return { ...f, datePreset: defaults.datePreset, fromDate: null, toDate: null };
        default: return f;
      }
    });
  }, [defaults, setActiveFilters]);

  const headerHeight = hasNonDefaultFilters ? 110 : 64;

  return (
    <View className="flex-1 bg-background">
      {/* Top scroll edge — MaskedView fade */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + headerHeight + 16, zIndex: 5 }}
        pointerEvents="none"
        maskElement={
          <LinearGradient
            colors={['rgba(0,0,0,1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
            locations={[0, 0.55, 1]}
            style={{ flex: 1 }}
          />
        }
      >
        <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#fafbfc' }} />
      </MaskedView>

      {/* Header — floating overlay */}
      <View className="absolute left-0 right-0 z-10 px-5 pb-2 pt-4" style={{ top: insets.top }}>
        {!user ? (
          <View className="flex-row items-center gap-3">
            <Skeleton width={44} height={44} borderRadius={22} />
            <Skeleton width="100%" height={44} borderRadius={22} style={{ flex: 1 }} />
            <Skeleton width={44} height={44} borderRadius={22} />
          </View>
        ) : (
          <View className="flex-row items-center gap-3">
            {/* Avatar — glass circle */}
            <Pressable onPress={() => router.push('/(tabs)/settings' as Href)}>
              {glassAvailable ? (
                <GlassView
                  isInteractive
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
                >
                  {user.profilePictureUrl ? (
                    <Image source={{ uri: user.profilePictureUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  ) : (
                    <Text className="text-lg font-bold text-primary">
                      {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                    </Text>
                  )}
                </GlassView>
              ) : (
                <View className="relative">
                  {user.profilePictureUrl ? (
                    <Image source={{ uri: user.profilePictureUrl }} className="h-10 w-10 rounded-full" />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Text className="text-lg font-bold text-primary">
                        {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {isPro && (
                <View className="absolute -bottom-0.5 -right-0.5 h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-background bg-pro">
                  <IconSymbol name="crown.fill" size={8} color="#fff" />
                </View>
              )}
            </Pressable>

            {/* Summary — glass capsule */}
            {glassAvailable ? (
              <GlassView
                style={{ flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                  {t.home_billCount(bills.length)}
                  {bills.length > 0 && (
                    <>
                      {'  ·  '}
                      {formatCurrency(bills.reduce((sum, b) => {
                        const bc = (b.country as 'CO' | 'US') || 'CO';
                        const cat = (b.tags?.find((t) => t.isPlatform)?.slug as 'dining' | 'retail' | 'service') || 'dining';
                        const tc = withTaxIncludedOverride(getTaxConfig(bc, cat), b.taxIncludedOverride ?? undefined);
                        const items = b.items.reduce((s, i) => s + i.subtotal, 0);
                        const base = computeBase(items, tc);
                        const tax = computeTax(items, tc);
                        const tip = b.useCustomTip ? (b.tip ?? 0) : base * ((b.tipPercent ?? 0) / 100);
                        return sum + base + tax + tip;
                      }, 0), country)}
                    </>
                  )}
                </Text>
              </GlassView>
            ) : (
              <View className="flex-1">
                <Text className="text-3xl font-extrabold tracking-tight text-foreground">
                  {t.home_greeting(firstName)}
                </Text>
                <View className="mt-1 flex-row items-center gap-3">
                  <Text className="text-sm text-muted-foreground">
                    {t.home_billCount(bills.length)}
                  </Text>
                  {bills.length > 0 && (
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(bills.reduce((sum, b) => {
                        const bc = (b.country as 'CO' | 'US') || 'CO';
                        const cat = (b.tags?.find((t) => t.isPlatform)?.slug as 'dining' | 'retail' | 'service') || 'dining';
                        const tc = withTaxIncludedOverride(getTaxConfig(bc, cat), b.taxIncludedOverride ?? undefined);
                        const items = b.items.reduce((s, i) => s + i.subtotal, 0);
                        const base = computeBase(items, tc);
                        const tax = computeTax(items, tc);
                        const tip = b.useCustomTip ? (b.tip ?? 0) : base * ((b.tipPercent ?? 0) / 100);
                        return sum + base + tax + tip;
                      }, 0), country)}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Filter button — glass circle */}
            <Pressable onPress={() => setFilterSheetVisible(true)}>
              {glassAvailable ? (
                <GlassView
                  isInteractive
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconSymbol name="line.3.horizontal.decrease" size={18} color={iconColors.primary} />
                  {hasNonDefaultFilters && (
                    <View className="absolute -top-1 -right-1 h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Text className="text-sm font-bold text-primary-foreground">{nonDefaultFilterCount}</Text>
                    </View>
                  )}
                </GlassView>
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-card border border-border">
                  <IconSymbol name="line.3.horizontal.decrease" size={18} color={iconColors.muted} />
                  {hasNonDefaultFilters && (
                    <View className="absolute -top-1 -right-1 h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Text className="text-sm font-bold text-primary-foreground">{nonDefaultFilterCount}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Filter chips — inside the floating header */}
        {hasNonDefaultFilters && (
          <View className="mt-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row items-center gap-2">
                {appliedFilterChips.filter((chip) => !chip.isDefault).map((chip) => (
                  glassAvailable ? (
                    <Pressable
                      key={chip.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        dismissFilter(chip.key);
                      }}
                    >
                      <GlassView
                        isInteractive
                        style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}
                      >
                        <Text className="text-sm font-semibold text-foreground">{chip.label}</Text>
                      </GlassView>
                    </Pressable>
                  ) : (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      isActive
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); dismissFilter(chip.key); }}
                    />
                  )
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Bill List — always mounted to avoid GlassView initial mount race */}
      <FlashList<Bill>
        data={isLoading ? [] : bills}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, paddingVertical: 3 }}>
            <SwipeableRow onDelete={() => handleDeleteBill(item._id)}>
              <BillCard
                bill={item}
                onPress={() => {
                  const locked = !isPro && item._creationTime < historyCutoff;
                  if (locked) {
                    showPaywall();
                    return;
                  }
                  router.push(`/bills/${item._id}` as Href);
                }}
                locked={!isPro && item._creationTime < historyCutoff}
                t={t}
              />
            </SwipeableRow>
          </View>
        )}
        contentContainerStyle={{ paddingTop: insets.top + headerHeight + 16, paddingBottom: 100, minHeight: Dimensions.get('window').height }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => { if (paginationStatus === 'CanLoadMore') loadMore(20); }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor={iconColors.primary}
            colors={[iconColors.primary]}
            progressViewOffset={insets.top + headerHeight + 20}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View>
              {Array.from({ length: 5 }).map((_, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 100).duration(300)}
                  style={{ paddingHorizontal: 20, paddingVertical: 3 }}
                >
                  <View style={{ marginBottom: 10 }}>
                    <BillCardSkeleton />
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-8 pt-32">
              <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/[0.08]">
                <IconSymbol name="receipt" size={32} color={iconColors.primary} />
              </View>
              <Text className="text-xl font-bold text-foreground">{t.home_noBills}</Text>
              <Text className="mt-1.5 text-center text-base text-muted-foreground">
                {t.home_noBillsHint}
              </Text>
              <Pressable
                onPress={openNewBillSheet}
                className="mt-5 flex-row items-center gap-2 rounded-full bg-primary px-5 py-2.5 active:opacity-80"
              >
                <IconSymbol name="plus" size={16} color={iconColors.primaryForeground} />
                <Text className="text-base font-semibold text-primary-foreground">
                  {t.home_addFirstBill}
                </Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        filters={activeFilters}
        billsByState={billsByState}
        activeBillCount={activeBillCount}
        availableContacts={billContacts}
        country={userCountry}
        minTotal={minTotal}
        maxTotal={maxTotal}
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
