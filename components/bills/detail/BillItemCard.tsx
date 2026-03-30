import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from '@/lib/expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import SwipeableItem from '@/components/bills/SwipeableItem';
import type { Id } from '@/convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';

interface BillItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface AssignedContact {
  contactId: Id<'contacts'>;
  name: string;
  phone?: string;
  imageUri?: string;
  items: string[];
  amount: number;
  paid: boolean;
}

interface BillItemCardProps {
  item: BillItem;
  index: number;
  billCountry: string;
  stateStyle: { borderClass: string };
  assignedContacts: AssignedContact[];
  isEditing: boolean;
  isDeleting: boolean;
  multiSelectMode: boolean;
  isSelected: boolean;
  iconColors: Record<string, string>;
  t: Translations;
  swipeOpenRef: React.MutableRefObject<boolean>;
  onPress: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, field: 'name' | 'quantity' | 'unitPrice', value: string) => void;
  onDismissEdit: () => void;
  onAssignContact: (itemId: string) => void;
  onRemoveContact: (itemId: string, contactId: Id<'contacts'>) => void;
  onToggleSelection: (itemId: string) => void;
}

function BillItemCard({
  item,
  index,
  billCountry,
  stateStyle,
  assignedContacts,
  isEditing,
  isDeleting,
  multiSelectMode,
  isSelected,
  iconColors,
  t,
  swipeOpenRef,
  onPress,
  onRemoveItem,
  onUpdateItem,
  onDismissEdit,
  onAssignContact,
  onRemoveContact,
  onToggleSelection,
}: BillItemCardProps) {
  const itemId = item.id!;
  const hasContacts = assignedContacts.length > 0;
  const borderClass = hasContacts ? stateStyle.borderClass : 'border-l-muted-foreground/20';

  return (
    <SwipeableItem isDeleting={isDeleting}>
      <Swipeable
        renderRightActions={() => (
          <View className="w-20 items-center justify-center rounded-r-xl bg-destructive">
            <IconSymbol name="xmark" size={18} color={iconColors.primaryForeground} />
            <Text className="mt-0.5 text-[10px] font-medium text-white">{t.delete}</Text>
          </View>
        )}
        rightThreshold={80}
        overshootRight
        onSwipeableOpen={() => onRemoveItem(itemId)}
        onSwipeableOpenStartDrag={() => { swipeOpenRef.current = true; }}
      >
        {isEditing ? (
          /* Edit mode */
          <View className={cn('mx-7 mb-2 rounded-xl border-l-[3px] border-l-primary bg-primary/5 px-4 py-3.5')}>
            <View className="mb-3 flex-row items-center justify-between">
              <Input
                value={item.name}
                onChangeText={(v) => onUpdateItem(itemId, 'name', v)}
                className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] font-semibold shadow-none"
                placeholder={t.scan_itemName}
                autoFocus
              />
              <Pressable
                onPress={onDismissEdit}
                className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
              >
                <Text className="text-xs font-semibold text-destructive">{t.cancel}</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
                <Input
                  value={String(item.quantity)}
                  onChangeText={(v) => onUpdateItem(itemId, 'quantity', v)}
                  className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-[2]">
                <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
                <Input
                  value={formatCurrency(item.unitPrice, billCountry)}
                  onChangeText={(v) => onUpdateItem(itemId, 'unitPrice', v)}
                  className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-[2]">
                <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
                <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                  <Text className="text-sm font-bold text-primary">
                    {formatCurrency(item.subtotal, billCountry)}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={onDismissEdit}
              className="mt-3 items-center rounded-lg bg-primary/10 py-2"
            >
              <Text className="text-sm font-semibold text-primary">{t.done}</Text>
            </Pressable>
          </View>
        ) : (
          /* Display mode */
          <Pressable
            onPress={() => multiSelectMode ? onToggleSelection(itemId) : onPress(itemId)}
            className={cn(
              'mx-7 mb-2 flex-row items-start rounded-xl border-l-[3px] bg-card px-4 py-3 active:opacity-80',
              borderClass,
            )}
          >
            {/* Checkbox in multi-select mode */}
            {multiSelectMode && (
              <View className="mr-3 justify-center pt-1">
                <IconSymbol
                  name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                  size={22}
                  color={isSelected ? iconColors.primary : iconColors.muted}
                />
              </View>
            )}
            <View className="mr-3 flex-1">
              <Text className="text-[15px] font-semibold leading-5 text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                {item.quantity} × {formatCurrency(item.unitPrice, billCountry)}
              </Text>

              {/* Contact chips */}
              {hasContacts && (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {assignedContacts.map((c) => (
                    <Pressable
                      key={String(c.contactId)}
                      onLongPress={() => item.id && onRemoveContact(item.id, c.contactId)}
                      className={cn(
                        'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1',
                        c.paid
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : 'border-primary/20 bg-primary/10',
                      )}
                    >
                      {c.imageUri ? (
                        <Image source={{ uri: c.imageUri }} className="w-4 h-4 rounded-full" />
                      ) : (
                        <IconSymbol name="person.crop.circle" size={13} color={c.paid ? '#10b981' : iconColors.primary} />
                      )}
                      <Text className={cn(
                        'text-[11px] font-medium',
                        c.paid ? 'text-emerald-500' : 'text-primary',
                      )}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="items-end gap-1">
              <Text className="text-[15px] font-bold tabular-nums text-foreground">
                {formatCurrency(item.subtotal, billCountry)}
              </Text>
              {!multiSelectMode && (
                <Pressable
                  onPress={() => onAssignContact(itemId)}
                  className="h-8 w-8 items-center justify-center rounded-full border border-dashed border-primary/30 bg-primary/5"
                >
                  <IconSymbol name="plus" size={14} color={iconColors.primary} />
                </Pressable>
              )}
            </View>
          </Pressable>
        )}
      </Swipeable>
    </SwipeableItem>
  );
}

export default React.memo(BillItemCard);
