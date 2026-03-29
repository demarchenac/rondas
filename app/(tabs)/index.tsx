import { useState, useCallback } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useQuery, useMutation } from 'convex/react';
import type { Doc } from '@/convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/convex/_generated/api';
import { formatCurrency } from '@/lib/format';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/i18n';

type Bill = Doc<'bills'>;
type BillState = 'draft' | 'unsplit' | 'split' | 'unresolved';

const STATE_STYLES: Record<BillState, { color: string; bg: string }> = {
  draft: { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  unsplit: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  split: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  unresolved: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

function stateLabel(t: Translations, state: BillState): string {
  const map: Record<BillState, string> = {
    draft: t.state_draft,
    unsplit: t.state_unsplit,
    split: t.state_split,
    unresolved: t.state_unresolved,
  };
  return map[state];
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function BillCard({
  bill,
  iconColors,
  onPress,
  t,
}: {
  bill: Bill;
  iconColors: typeof ICON_COLORS.light;
  onPress: () => void;
  t: Translations;
}) {
  const stateStyle = STATE_STYLES[bill.state];
  const label = stateLabel(t, bill.state);
  const contactCount = bill.contacts.length;
  const itemCount = bill.items.length;
  const assignedItems = bill.state !== 'unsplit' && bill.state !== 'draft'
    ? new Set(bill.contacts.flatMap((c) => c.items)).size
    : 0;
  const progress = itemCount > 0 ? assignedItems / itemCount : 0;

  return (
    <Pressable
      onPress={onPress}
      style={{ borderLeftWidth: 3, borderLeftColor: stateStyle.color }}
      className="rounded-xl bg-card px-4 py-3.5 active:opacity-80"
    >
      {/* Top row: name + badge */}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {bill.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: stateStyle.bg,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stateStyle.color }} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: stateStyle.color }}>
            {label}
          </Text>
        </View>
      </View>

      {/* Bottom row: amount + meta */}
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(bill.total, bill.country)}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {relativeTime(bill._creationTime)} · {t.billCard_items(itemCount)}
          </Text>
        </View>

        {/* Contact avatars or item count */}
        {contactCount > 0 ? (
          <View className="flex-row items-center">
            {bill.contacts.slice(0, 3).map((c, i) => (
              c.imageUri ? (
                <Image
                  key={i}
                  source={{ uri: c.imageUri }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    marginLeft: i > 0 ? -8 : 0,
                    borderWidth: 2,
                    borderColor: '#1a2540',
                  }}
                />
              ) : (
                <View
                  key={i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: stateStyle.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: i > 0 ? -8 : 0,
                    borderWidth: 2,
                    borderColor: '#1a2540',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: stateStyle.color }}>
                    {c.name[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )
            ))}
            {contactCount > 3 && (
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: 'rgba(148,163,184,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: -8,
                  borderWidth: 2,
                  borderColor: '#1a2540',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#8b9cc0' }}>
                  +{contactCount - 3}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Progress bar for unresolved bills */}
      {bill.state === 'unresolved' && itemCount > 0 && (
        <View className="mt-2.5">
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(148,163,184,0.15)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: stateStyle.color,
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: '#8b9cc0', marginTop: 3 }}>
            {t.billCard_assigned(assignedItems, itemCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 ${
        active ? 'bg-primary' : 'border border-border bg-card'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          active ? 'text-primary-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={{
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.2)',
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              color: active ? '#fff' : '#8b9cc0',
            }}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const [activeFilter, setActiveFilter] = useState<BillState | 'all'>('all');

  const bills = useQuery(api.bills.list, user ? { userId: user.id } : 'skip');
  const removeBill = useMutation(api.bills.remove);

  const allBills = bills ?? [];
  const nonDraftBills = allBills.filter((b) => b.state !== 'draft');
  const filteredBills =
    activeFilter === 'all'
      ? nonDraftBills
      : allBills.filter((b) => b.state === activeFilter);

  const totalAmount = nonDraftBills.reduce((sum, b) => sum + b.total, 0);
  const unpaidAmount = nonDraftBills
    .filter((b) => b.state === 'unresolved')
    .reduce((sum, b) => {
      const unpaid = b.contacts.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0);
      return sum + unpaid;
    }, 0);

  // Count per state for filter badges
  const counts = {
    draft: allBills.filter((b) => b.state === 'draft').length,
    unsplit: allBills.filter((b) => b.state === 'unsplit').length,
    split: allBills.filter((b) => b.state === 'split').length,
    unresolved: allBills.filter((b) => b.state === 'unresolved').length,
  };

  const handleDeleteBill = useCallback((billId: string) => {
    Alert.alert(t.home_deleteBill, t.home_deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          await removeBill({ id: billId as any, userId: user!.id });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [removeBill, t, user]);

  const { extractPhotoTime, useLocation: useLocationSetting, country } = useSettingsStore();

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.home_permissionNeeded, t.home_permissionCamera);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: extractPhotoTime,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photoTakenAt = extractPhotoTime ? (asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime) : undefined;

        // Navigate immediately, resolve location in background
        const params: Record<string, string> = { imageUri: asset.uri };
        if (photoTakenAt) params.photoTakenAt = String(photoTakenAt);
        if (useLocationSetting) params.resolveLocation = 'device';
        router.push({ pathname: '/bills/new', params } as Href);
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.home_permissionNeeded, t.home_permissionLibrary);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photoTakenAt = extractPhotoTime ? (asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime) : undefined;
        const gpsLat = asset.exif?.GPSLatitude;
        const gpsLng = asset.exif?.GPSLongitude;
        const gpsLatRef = asset.exif?.GPSLatitudeRef;
        const gpsLngRef = asset.exif?.GPSLongitudeRef;

        // Navigate immediately with raw GPS, resolve place name in new.tsx
        const params: Record<string, string> = { imageUri: asset.uri };
        if (photoTakenAt) params.photoTakenAt = String(photoTakenAt);
        if (gpsLat != null && gpsLng != null) {
          params.latitude = String(gpsLatRef === 'S' ? -gpsLat : gpsLat);
          params.longitude = String(gpsLngRef === 'W' ? -gpsLng : gpsLng);
          params.resolveLocation = 'exif';
        }
        router.push({ pathname: '/bills/new', params } as Href);
      }
    }
  }, [router, extractPhotoTime, useLocationSetting, t]);

  const handleFABPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.cancel, t.home_takePhoto, t.home_chooseLibrary],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage('camera');
          if (buttonIndex === 2) pickImage('library');
        }
      );
    } else {
      Alert.alert(t.home_addBill, t.home_addBillHow, [
        { text: t.cancel, style: 'cancel' },
        { text: t.home_takePhoto, onPress: () => pickImage('camera') },
        { text: t.home_chooseLibrary, onPress: () => pickImage('library') },
      ]);
    }
  }, [pickImage, t]);

  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? 'there';

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
                {t.home_billCount(nonDraftBills.length)}
              </Text>
              <Text className="text-xs font-semibold text-foreground">
                {formatCurrency(totalAmount, country)}
              </Text>
              {unpaidAmount > 0 && (
                <>
                  <View className="h-3 w-px bg-border" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b' }}>
                    {t.home_pending(formatCurrency(unpaidAmount, country))}
                  </Text>
                </>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings' as Href)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: iconColors.primary }}>
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="px-5 py-2.5">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <FilterChip label={t.filter_all} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} count={nonDraftBills.length} />
            {counts.draft > 0 && (
              <FilterChip label={t.filter_draft} active={activeFilter === 'draft'} onPress={() => setActiveFilter('draft')} count={counts.draft} />
            )}
            <FilterChip label={t.filter_unsplit} active={activeFilter === 'unsplit'} onPress={() => setActiveFilter('unsplit')} count={counts.unsplit} />
            <FilterChip label={t.filter_unresolved} active={activeFilter === 'unresolved'} onPress={() => setActiveFilter('unresolved')} count={counts.unresolved} />
            <FilterChip label={t.filter_split} active={activeFilter === 'split'} onPress={() => setActiveFilter('split')} count={counts.split} />
            {activeFilter !== 'all' && (
              <Pressable
                onPress={() => setActiveFilter('all')}
                className="items-center justify-center rounded-full border border-destructive/30 px-3 py-1.5"
              >
                <IconSymbol name="xmark" size={12} color="#ef4444" />
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Bill List */}
      {bills === undefined ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted-foreground">{t.loading}</Text>
        </View>
      ) : filteredBills.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <IconSymbol name="receipt" size={32} color={iconColors.primary} />
          </View>
          <Text className="text-lg font-bold text-foreground">{t.home_noBills}</Text>
          <Text className="mt-1.5 text-center text-sm text-muted-foreground">
            {t.home_noBillsHint}
          </Text>
          <Button variant="default" className="mt-5" onPress={handleFABPress}>
            <IconSymbol name="plus" size={16} color={colorScheme === 'dark' ? '#0c1a2a' : '#fff'} />
            <Text>{t.home_addFirstBill}</Text>
          </Button>
        </View>
      ) : (
        <FlashList<Bill>
          data={filteredBills}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View className="px-5 py-1">
              <Swipeable
                renderRightActions={() => (
                  <Pressable
                    onPress={() => handleDeleteBill(item._id)}
                    style={{
                      width: 80,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#ef4444',
                      borderRadius: 12,
                      marginLeft: 8,
                    }}
                  >
                    <IconSymbol name="xmark" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '500', marginTop: 2 }}>{t.delete}</Text>
                  </Pressable>
                )}
                rightThreshold={80}
                overshootRight={false}
              >
                <BillCard
                  bill={item}
                  iconColors={iconColors}
                  onPress={() => router.push(`/bills/${item._id}` as Href)}
                  t={t}
                />
              </Swipeable>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <View className="absolute bottom-28 right-5" style={{ marginBottom: insets.bottom }}>
        <Pressable
          onPress={handleFABPress}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:opacity-80"
        >
          <IconSymbol name="plus" size={28} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
        </Pressable>
      </View>
    </View>
  );
}
