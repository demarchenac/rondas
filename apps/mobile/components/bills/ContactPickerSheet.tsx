import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View, Pressable, TextInput } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from '@/lib/expo-image';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';
import { ICON_COLORS } from '@/constants/colors';
import { formatPhone } from '@/lib/phone';
import type { Doc } from '@convex/_generated/dataModel';

export const SUGGESTED_PREFIX = 'suggested:';
export const SELF_PREFIX = 'self:';
export const ANON_PREFIX = 'anon:';

interface PhoneContact {
  id: string;
  givenName?: string | null;
  familyName?: string | null;
  phones?: { number?: string }[];
  image?: string | null;
}

interface ContactPickerSheetProps {
  visible: boolean;
  phoneContacts: PhoneContact[];
  suggestedContacts?: { frequent: Doc<'contacts'>[]; recent: Doc<'contacts'>[] };
  selfContact?: Doc<'contacts'> | null;
  billContacts?: Doc<'contacts'>[];
  selectedContactIds: Set<string>;
  excludePhones?: Set<string>;
  excludeSelf?: boolean;
  maxSelectable?: number;
  bottomInset: number;
  onToggleContact: (contactId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ContactPickerSheet({
  visible,
  phoneContacts,
  suggestedContacts,
  selfContact,
  billContacts,
  selectedContactIds,
  excludePhones,
  excludeSelf,
  maxSelectable,
  bottomInset,
  onToggleContact,
  onConfirm,
  onClose,
}: ContactPickerSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const shouldUseGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  const [search, setSearch] = useState('');
  const [anonCounter, setAnonCounter] = useState(0);
  const [wasPrevVisible, setPrevVisible] = useState(false);
  if (visible !== wasPrevVisible) {
    setPrevVisible(visible);
    if (visible) { setSearch(''); setAnonCounter(0); }
  }

  const handleAddAnonymous = useCallback(() => {
    const next = anonCounter + 1;
    setAnonCounter(next);
    const key = `${ANON_PREFIX}${next}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleContact(key);
  }, [anonCounter, onToggleContact]);

  const baseContacts = useMemo(() => {
    if (!excludePhones || excludePhones.size === 0) return phoneContacts;
    return phoneContacts.filter((c) => {
      const phone = c.phones?.[0]?.number;
      return !phone || !excludePhones.has(phone);
    });
  }, [phoneContacts, excludePhones]);

  const filteredContacts = useMemo(() => {
    if (!search) return baseContacts;
    const lowercaseSearch = search.toLowerCase();
    return baseContacts.filter((c) => {
      const name = `${c.givenName ?? ''} ${c.familyName ?? ''}`.toLowerCase();
      return name.includes(lowercaseSearch);
    });
  }, [baseContacts, search]);

  const filteredSuggested = useMemo(() => {
    if (!suggestedContacts) return undefined;
    if (!excludePhones || excludePhones.size === 0) return suggestedContacts;
    const filterFn = (c: Doc<'contacts'>) => !c.phone || !excludePhones.has(c.phone);
    return {
      frequent: suggestedContacts.frequent.filter(filterFn),
      recent: suggestedContacts.recent.filter(filterFn),
    };
  }, [suggestedContacts, excludePhones]);

  const atCapacity = maxSelectable !== undefined && selectedContactIds.size >= maxSelectable;

  const renderSuggestedContact = useCallback((c: Doc<'contacts'>) => {
    const key = `${SUGGESTED_PREFIX}${c._id}`;
    const isSelected = selectedContactIds.has(key);
    const isDisabled = !isSelected && atCapacity;
    return (
      <Pressable
        key={key}
        onPress={() => { if (isDisabled) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleContact(key); }}
        className={`flex-row items-center py-2.5 gap-3 ${isDisabled ? 'opacity-40' : ''}`}
      >
        <IconSymbol
          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          color={isSelected ? iconColors.primary : iconColors.muted}
        />
        {c.imageUri ? (
          <Image source={{ uri: c.imageUri }} className="w-9 h-9 rounded-full" />
        ) : (
          <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
            <Text className="text-base font-bold text-primary">
              {(c.name[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">{c.name}</Text>
          {c.phone && (
            <Text className="text-sm text-muted-foreground">{formatPhone(c.phone)}</Text>
          )}
        </View>
      </Pressable>
    );
  }, [selectedContactIds, onToggleContact, iconColors, atCapacity]);

  const renderContactRow = useCallback(({ item: c }: { item: PhoneContact }) => {
    const isSelected = selectedContactIds.has(c.id);
    const isDisabled = !isSelected && atCapacity;
    return (
      <Pressable
        onPress={() => { if (isDisabled) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleContact(c.id); }}
        className={`flex-row items-center py-2.5 gap-3 px-7 ${isDisabled ? 'opacity-40' : ''}`}
      >
        <IconSymbol
          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          color={isSelected ? iconColors.primary : iconColors.muted}
        />
        {c.image ? (
          <Image source={{ uri: c.image }} className="w-9 h-9 rounded-full" />
        ) : (
          <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
            <Text className="text-base font-bold text-primary">
              {(c.givenName?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">
            {`${c.givenName ?? ''} ${c.familyName ?? ''}`.trim() || 'Unknown'}
          </Text>
          {c.phones?.[0]?.number && (
            <Text className="text-sm text-muted-foreground">{formatPhone(c.phones![0].number!)}</Text>
          )}
        </View>
      </Pressable>
    );
  }, [selectedContactIds, onToggleContact, iconColors, atCapacity]);

  const showSelf = !search && selfContact && !excludeSelf;

  const renderSelfContact = useCallback(() => {
    if (!selfContact) return null;
    const key = `${SELF_PREFIX}${selfContact._id}`;
    const isSelected = selectedContactIds.has(key);
    const isDisabled = !isSelected && atCapacity;
    return (
      <Pressable
        key={key}
        onPress={() => { if (isDisabled) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleContact(key); }}
        className={`flex-row items-center py-2.5 gap-3 ${isDisabled ? 'opacity-40' : ''}`}
      >
        <IconSymbol
          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          color={isSelected ? iconColors.primary : iconColors.muted}
        />
        {selfContact.imageUri ? (
          <Image source={{ uri: selfContact.imageUri }} className="w-9 h-9 rounded-full" />
        ) : (
          <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
            <Text className="text-base font-bold text-primary">
              {(selfContact.name[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">{t.self_label(selfContact.name)}</Text>
        </View>
      </Pressable>
    );
  }, [selfContact, selectedContactIds, onToggleContact, iconColors, atCapacity, t]);

  const listHeader = useMemo(() => {
    const shownIds = new Set<string>();

    const billSection = billContacts?.filter((c) => {
      if (excludePhones && c.phone && excludePhones.has(c.phone)) return false;
      return true;
    }) ?? [];
    billSection.forEach((c) => shownIds.add(String(c._id)));

    const frequentSection = (filteredSuggested?.frequent ?? []).filter((c) => !shownIds.has(String(c._id)));
    frequentSection.forEach((c) => shownIds.add(String(c._id)));

    const recentSection = (filteredSuggested?.recent ?? []).filter((c) => !shownIds.has(String(c._id)));
    recentSection.forEach((c) => shownIds.add(String(c._id)));

    return (
      <View className="px-7">
        {showSelf && (
          <View className="mb-2">
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_you}
            </Text>
            {renderSelfContact()}
          </View>
        )}
        {billSection.length > 0 && (
          <View className="mb-2">
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_onBill}
            </Text>
            {billSection.map(renderSuggestedContact)}
          </View>
        )}
        {!search && frequentSection.length > 0 && (
          <View className="mb-2">
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_frequent}
            </Text>
            {frequentSection.map(renderSuggestedContact)}
          </View>
        )}
        {!search && recentSection.length > 0 && (
          <View className="mb-2">
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_recent}
            </Text>
            {recentSection.map(renderSuggestedContact)}
          </View>
        )}
        <Text className="mb-1 mt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.contactPicker_allContacts}
        </Text>
      </View>
    );
  }, [showSelf, search, billContacts, filteredSuggested, excludePhones, renderSelfContact, renderSuggestedContact, t]);

  const listEmpty = useMemo(() => {
    if (phoneContacts.length === 0) {
      return (
        <View className="items-center justify-center py-12">
          <ActivityIndicator size="large" color={iconColors.primary} />
        </View>
      );
    }
    return null;
  }, [phoneContacts.length, iconColors.primary]);

  return (
    <TrueSheet
      ref={sheetRef}
      name="contact-picker"
      detents={[1]}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      scrollable
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ flex: 1 }}>
        {/* Virtualized contact list — full height */}
        <FlashList
          data={filteredContacts}
          renderItem={renderContactRow}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={{ paddingTop: 160, paddingBottom: insets.bottom + 140 }}
          keyboardShouldPersistTaps="handled"
        />

        {/* Floating header */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent', paddingHorizontal: 28 }}>
          <Text className="pt-7 pb-3 text-2xl font-bold text-foreground">{t.contactPicker_title}</Text>

          {/* Glass search input */}
          {shouldUseGlass ? (
            <GlassView tintColor={iconColors.primary + '0D'} style={{ borderRadius: 12, marginBottom: 8 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.contactPicker_search}
                placeholderTextColor={iconColors.muted}
                style={{ paddingHorizontal: 16, paddingVertical: 10, fontSize: 17, color: colorScheme === 'dark' ? '#fff' : '#000' }}
              />
            </GlassView>
          ) : (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.contactPicker_search}
              placeholderTextColor={iconColors.muted}
              className="mb-2 rounded-xl bg-muted-foreground/[0.08] px-4 py-2.5 text-lg text-foreground"
            />
          )}

          {/* Glass add anonymous button */}
          <Pressable
            onPress={handleAddAnonymous}
            disabled={atCapacity}
            style={{ backgroundColor: 'transparent', opacity: atCapacity ? 0.4 : 1, alignSelf: 'flex-start' }}
            className="active:opacity-80"
          >
            {shouldUseGlass ? (
              <GlassView isInteractive style={{ borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconSymbol name="person.badge.plus" size={18} color={iconColors.primary} />
                <Text className="text-base font-medium text-primary">{t.contactPicker_addAnonymous}</Text>
              </GlassView>
            ) : (
              <View className="flex-row items-center gap-3 py-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <IconSymbol name="person.badge.plus" size={18} color={iconColors.primary} />
                </View>
                <Text className="text-base font-medium text-primary">{t.contactPicker_addAnonymous}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Top fade */}
        <MaskedView
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 180, zIndex: 5 }}
          pointerEvents="none"
          maskElement={
            <LinearGradient
              colors={['rgba(0,0,0,1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
              locations={[0, 0.65, 1]}
              style={{ flex: 1 }}
            />
          }
        >
          <View className="flex-1 bg-background" />
        </MaskedView>

        {/* Bottom fade */}
        <MaskedView
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 140, zIndex: 5 }}
          pointerEvents="none"
          maskElement={
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,1)']}
              locations={[0, 0.3, 1]}
              style={{ flex: 1 }}
            />
          }
        >
          <View className="flex-1 bg-background" />
        </MaskedView>

        {/* Footer — floating glass confirm button */}
        {selectedContactIds.size > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 48, zIndex: 10, backgroundColor: 'transparent', paddingHorizontal: 28 }}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(); }}
              style={{ backgroundColor: 'transparent' }}
              className="active:opacity-80"
            >
              {shouldUseGlass ? (
                <GlassView isInteractive tintColor={iconColors.primary + '0D'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-lg font-bold text-primary">
                    {t.contactPicker_assign(selectedContactIds.size)}
                  </Text>
                </GlassView>
              ) : (
                <View className="items-center rounded-xl bg-primary py-3.5">
                  <Text className="text-lg font-bold text-primary-foreground">
                    {t.contactPicker_assign(selectedContactIds.size)}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </TrueSheet>
  );
}

export default React.memo(ContactPickerSheet);
