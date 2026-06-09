import React from 'react';
import { Pressable, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import BulkToolbar from '@/components/bills/BulkToolbar';
import type { IconPalette } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';

interface BillDetailActionBarProps {
  shouldUseGlass: boolean;
  isMultiSelectMode: boolean;
  selectedItemIds: Set<string>;
  hasContacts: boolean;
  hasContactsOnSelection: boolean;
  billState: string;
  contactCount: number;
  bottomInset: number;
  iconColors: IconPalette;
  t: Translations;
  onSharePress: () => void;
  onAddItem: () => void;
  onMultiAssign: () => void;
  onBulkRemoveContact: () => void;
  onBulkDelete: () => void;
}

function BillDetailActionBar({
  shouldUseGlass,
  isMultiSelectMode,
  selectedItemIds,
  hasContacts,
  hasContactsOnSelection,
  billState,
  contactCount,
  bottomInset,
  iconColors,
  t,
  onSharePress,
  onAddItem,
  onMultiAssign,
  onBulkRemoveContact,
  onBulkDelete,
}: BillDetailActionBarProps) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset, zIndex: 10, backgroundColor: 'transparent', paddingHorizontal: 28 }}>
      {!isMultiSelectMode && hasContacts && billState !== 'draft' && (
        <Pressable onPress={onSharePress} style={{ backgroundColor: 'transparent', marginBottom: 8 }} className="active:opacity-80">
          {shouldUseGlass ? (
            <GlassView isInteractive style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <IconSymbol name="person.2.fill" size={18} color={iconColors.primary} />
              <Text className="text-lg font-semibold text-foreground">{t.share_button(contactCount)}</Text>
            </GlassView>
          ) : (
            <View className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-4">
              <IconSymbol name="person.2.fill" size={18} color={iconColors.primaryForeground} />
              <Text className="text-lg font-semibold text-primary-foreground">{t.share_button(contactCount)}</Text>
            </View>
          )}
        </Pressable>
      )}
      {isMultiSelectMode && selectedItemIds.size > 0 && (
        <BulkToolbar
          selectedItemIds={selectedItemIds}
          hasContactsOnSelection={hasContactsOnSelection}
          onAssign={onMultiAssign}
          onUnassign={onBulkRemoveContact}
          onDelete={onBulkDelete}
        />
      )}
      <Pressable onPress={onAddItem} style={{ backgroundColor: 'transparent', marginBottom: 8 }} className="active:opacity-80">
        {shouldUseGlass ? (
          <GlassView isInteractive style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <IconSymbol name="plus" size={14} color={iconColors.primary} />
            <Text className="text-base font-semibold text-primary">{t.scan_addItem}</Text>
          </GlassView>
        ) : (
          <View className="flex-row items-center justify-center gap-2 rounded-xl bg-primary/10 py-3">
            <IconSymbol name="plus" size={14} color={iconColors.primary} />
            <Text className="text-base font-semibold text-primary">{t.scan_addItem}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default React.memo(BillDetailActionBar);
