import React from 'react';
import { Modal, View, Pressable, ScrollView, Alert, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/cn';

interface UnassignPickerSheetProps {
  visible: boolean;
  contacts: Array<{ name: string; imageUri?: string; items: string[]; contactIndex: number }>;
  selectedItemIds: Set<string>;
  selectedContactIds: Set<string>;
  bottomInset: number;
  onToggleContact: (contactKey: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function UnassignPickerSheet({
  visible,
  contacts,
  selectedItemIds,
  selectedContactIds,
  bottomInset,
  onToggleContact,
  onConfirm,
  onClose,
}: UnassignPickerSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  const contactsOnSelected = contacts.filter((c) =>
    c.items.some((itemId) => selectedItemIds.has(itemId))
  );

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
          <Text className="text-xl font-bold text-foreground">{t.unassignPicker_title}</Text>
          <Pressable onPress={onClose} className="rounded-full bg-muted p-2">
            <IconSymbol name="xmark" size={14} color={iconColors.muted} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
          {contactsOnSelected.map((c) => {
            const isSelected = selectedContactIds.has(String(c.contactIndex));
            const itemCount = c.items.filter((itemId) => selectedItemIds.has(itemId)).length;
            return (
              <Pressable
                key={c.contactIndex}
                onPress={() => onToggleContact(String(c.contactIndex))}
                className="flex-row items-center py-3 gap-3"
              >
                <IconSymbol
                  name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                  size={22}
                  color={isSelected ? iconColors.destructive : iconColors.muted}
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
                  <Text className="text-xs text-muted-foreground">
                    {t.unassignPicker_itemsOnSelection(itemCount)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedContactIds.size > 0 && (
          <View className="border-t border-border/30 px-7 pb-2 pt-3">
            <Pressable
              onPress={() => {
                Alert.alert(
                  t.bill_confirmRemoval,
                  t.bill_removeMultipleConfirm(selectedContactIds.size),
                  [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.remove, style: 'destructive', onPress: onConfirm },
                  ]
                );
              }}
              className="items-center py-4 rounded-xl border bg-destructive/15 border-destructive/30"
            >
              <Text className="text-base font-semibold text-destructive">
                {t.unassignPicker_remove(selectedContactIds.size)}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default React.memo(UnassignPickerSheet);
