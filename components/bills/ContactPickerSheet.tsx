import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, View, Pressable, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';
import { ICON_COLORS } from '@/constants/colors';
import type * as Contacts from 'expo-contacts';
import type { Doc } from '@/convex/_generated/dataModel';

export const SUGGESTED_PREFIX = 'suggested:';

type PhoneContact = Contacts.Contact & { id: string };

interface ContactPickerSheetProps {
  visible: boolean;
  phoneContacts: PhoneContact[];
  suggestedContacts?: { frequent: Doc<'contacts'>[]; recent: Doc<'contacts'>[] };
  selectedContactIds: Set<string>;
  bottomInset: number;
  onToggleContact: (contactId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ContactPickerSheet({
  visible,
  phoneContacts,
  suggestedContacts,
  selectedContactIds,
  bottomInset,
  onToggleContact,
  onConfirm,
  onClose,
}: ContactPickerSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  // Local search state — avoids re-rendering 660-line parent on every keystroke
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const filteredContacts = useMemo(() => {
    if (!search) return phoneContacts;
    const q = search.toLowerCase();
    return phoneContacts.filter((c) => {
      const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [phoneContacts, search]);

  const hasSuggested =
    !search &&
    suggestedContacts &&
    (suggestedContacts.frequent.length > 0 || suggestedContacts.recent.length > 0);

  const renderSuggestedContact = useCallback((c: Doc<'contacts'>) => {
    const key = `${SUGGESTED_PREFIX}${c._id}`;
    const isSelected = selectedContactIds.has(key);
    return (
      <Pressable
        key={key}
        onPress={() => onToggleContact(key)}
        className="flex-row items-center py-2.5 gap-3"
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
            <Text className="text-sm font-bold text-primary">
              {(c.name[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{c.name}</Text>
          {c.phone && (
            <Text className="text-xs text-muted-foreground">{c.phone}</Text>
          )}
        </View>
      </Pressable>
    );
  }, [selectedContactIds, onToggleContact, iconColors]);

  const renderContactRow = useCallback(({ item: c }: { item: PhoneContact }) => {
    const isSelected = selectedContactIds.has(c.id);
    return (
      <Pressable
        onPress={() => onToggleContact(c.id)}
        className="flex-row items-center py-2.5 gap-3 px-7"
      >
        <IconSymbol
          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          color={isSelected ? iconColors.primary : iconColors.muted}
        />
        {c.image?.uri ? (
          <Image source={{ uri: c.image.uri }} className="w-9 h-9 rounded-full" />
        ) : (
          <View className="w-9 h-9 rounded-full items-center justify-center bg-primary/10">
            <Text className="text-sm font-bold text-primary">
              {(c.firstName?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">
            {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Unknown'}
          </Text>
          {c.phoneNumbers?.[0]?.number && (
            <Text className="text-xs text-muted-foreground">{c.phoneNumbers[0].number}</Text>
          )}
        </View>
      </Pressable>
    );
  }, [selectedContactIds, onToggleContact, iconColors]);

  const listHeader = useMemo(() => {
    if (!hasSuggested) return null;
    return (
      <View className="px-7">
        {suggestedContacts!.frequent.length > 0 && (
          <View className="mb-2">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_frequent}
            </Text>
            {suggestedContacts!.frequent.map(renderSuggestedContact)}
          </View>
        )}
        {suggestedContacts!.recent.length > 0 && (
          <View className="mb-2">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.contactPicker_recent}
            </Text>
            {suggestedContacts!.recent.map(renderSuggestedContact)}
          </View>
        )}
        <Text className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.contactPicker_allContacts}
        </Text>
      </View>
    );
  }, [hasSuggested, suggestedContacts, renderSuggestedContact, t]);

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background pt-3" style={{ paddingBottom: bottomInset }}>
        <View className="items-center pb-2">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>
        <View className="flex-row items-center justify-between px-7 pb-3 pt-2">
          <Text className="text-xl font-bold text-foreground">{t.contactPicker_title}</Text>
          <Pressable onPress={onClose} className="rounded-full bg-muted p-2">
            <IconSymbol name="xmark" size={14} color={iconColors.muted} />
          </Pressable>
        </View>

        {/* Search — local state, no parent re-render */}
        <View className="px-7 pb-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.contactPicker_search}
            placeholderTextColor={iconColors.muted}
            className="rounded-xl bg-muted-foreground/[0.08] px-4 py-2.5 text-[15px] text-foreground"
          />
        </View>

        {/* Virtualized contact list */}
        <FlashList
          data={filteredContacts}
          renderItem={renderContactRow}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
        />

        {selectedContactIds.size > 0 && (
          <View className="border-t border-border/30 px-7 pb-2 pt-3">
            <Pressable
              onPress={onConfirm}
              className="items-center rounded-xl bg-primary py-4 active:opacity-80"
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {t.contactPicker_assign(selectedContactIds.size)}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default React.memo(ContactPickerSheet);
