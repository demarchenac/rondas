import React from 'react';
import { Modal, View, Pressable, ScrollView, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';
import { ICON_COLORS } from '@/constants/colors';
import type * as Contacts from 'expo-contacts';

interface ContactPickerSheetProps {
  visible: boolean;
  phoneContacts: (Contacts.Contact & { id: string })[];
  contactSearch: string;
  selectedContactIds: Set<string>;
  bottomInset: number;
  onSearchChange: (text: string) => void;
  onToggleContact: (contactId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ContactPickerSheet({
  visible,
  phoneContacts,
  contactSearch,
  selectedContactIds,
  bottomInset,
  onSearchChange,
  onToggleContact,
  onConfirm,
  onClose,
}: ContactPickerSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

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

        {/* Search */}
        <View className="px-7 pb-3">
          <TextInput
            value={contactSearch}
            onChangeText={onSearchChange}
            placeholder={t.contactPicker_search}
            placeholderTextColor={iconColors.muted}
            className="rounded-xl bg-muted-foreground/[0.08] px-4 py-2.5 text-[15px] text-foreground"
          />
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
          {phoneContacts
            .filter((c) => {
              if (!contactSearch) return true;
              const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase();
              return name.includes(contactSearch.toLowerCase());
            })
            .map((c) => {
              const isSelected = selectedContactIds.has(c.id!);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onToggleContact(c.id!)}
                  className="flex-row items-center py-2.5 gap-3"
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
            })}
        </ScrollView>

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
