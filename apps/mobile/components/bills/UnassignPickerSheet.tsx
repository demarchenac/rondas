import React, { useCallback, useEffect, useRef } from 'react';
import { View, Pressable , useColorScheme } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { ICON_COLORS } from '@/constants/colors';
import { useCustomAlert } from '@/components/ui/custom-alert';
import type { Id } from '@convex/_generated/dataModel';

interface UnassignPickerSheetProps {
  visible: boolean;
  contacts: { name: string; imageUri?: string; items: { itemId: string; units: number }[]; contactId: Id<'contacts'> }[];
  selectedItemIds: Set<string>;
  selectedContactIds: Set<string>;
  bottomInset: number;
  onToggleContact: (contactId: string) => void;
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
  const colorScheme = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { alert } = useCustomAlert();
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const contactsOnSelected = contacts.filter((c) =>
    c.items.some((ref) => selectedItemIds.has(ref.itemId))
  );

  const hasSelection = selectedContactIds.size > 0;

  return (
    <TrueSheet
      ref={sheetRef}
      name="unassign-picker"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ paddingBottom: bottomInset > 0 ? bottomInset : 16 }}>
        <Text className="px-6 pt-4 pb-4 text-2xl font-bold text-foreground">
          {t.unassignPicker_title}
        </Text>

        {contactsOnSelected.map((c, i) => {
          const isSelected = selectedContactIds.has(String(c.contactId));
          const itemCount = c.items.filter((ref) => selectedItemIds.has(ref.itemId)).length;
          const isLast = i === contactsOnSelected.length - 1;
          return (
            <Pressable
              key={String(c.contactId)}
              onPress={() => onToggleContact(String(c.contactId))}
              className="flex-row items-center gap-3 px-6 py-3"
            >
              <IconSymbol
                name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                size={24}
                color={isSelected ? iconColors.destructive : iconColors.muted}
              />
              {c.imageUri ? (
                <Image source={{ uri: c.imageUri }} className="w-10 h-10 rounded-full" />
              ) : (
                <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
                  <Text className="text-lg font-bold text-primary">
                    {(c.name[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View className={`flex-1 ${!isLast ? 'border-b border-border/20 pb-3' : ''}`}>
                <Text className="text-lg font-medium text-foreground">{c.name}</Text>
                <Text className="text-base text-muted-foreground">
                  {t.unassignPicker_itemsOnSelection(itemCount)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {hasSelection && (
          <View className="px-6 pt-3">
            <Pressable
              onPress={() => {
                alert(
                  t.bill_confirmRemoval,
                  t.bill_removeMultipleConfirm(selectedContactIds.size),
                  [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.remove, style: 'destructive', onPress: onConfirm },
                  ]
                );
              }}
              className="items-center py-4 rounded-2xl bg-destructive/10 active:opacity-80"
            >
              <Text className="text-lg font-semibold text-destructive">
                {t.unassignPicker_remove(selectedContactIds.size)}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </TrueSheet>
  );
}

export default React.memo(UnassignPickerSheet);
