import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import SwipeableItem from '@/components/bills/SwipeableItem';
import { formatCurrency } from '@/lib/format';
import type { IconPalette } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ReviewItemRowProps {
  item: BillItem;
  index: number;
  isEditing: boolean;
  isDeleting: boolean;
  isLast: boolean;
  country: string;
  iconColors: IconPalette;
  t: Translations;
  onPress: (index: number) => void;
  onDismissEdit: () => void;
  onRemove: (index: number) => void;
  onUpdateField: (index: number, field: keyof BillItem, value: string) => void;
}

function ReviewItemRow({
  item,
  index,
  isEditing,
  isDeleting,
  isLast,
  country,
  iconColors,
  t,
  onPress,
  onDismissEdit,
  onRemove,
  onUpdateField,
}: ReviewItemRowProps) {
  const renderDeleteAction = () => (
    <Animated.View className="flex-1 items-end justify-center bg-destructive pr-6">
      <IconSymbol name="xmark" size={18} color={iconColors.primaryForeground} />
      <Text className="mt-0.5 text-sm font-medium text-white">{t.delete}</Text>
    </Animated.View>
  );

  return (
    <SwipeableItem isDeleting={isDeleting}>
      <ReanimatedSwipeable
        renderRightActions={renderDeleteAction}
        rightThreshold={80}
        overshootRight
        onSwipeableOpen={() => onRemove(index)}
      >
        {isEditing ? (
          <View className="border-l-2 border-l-primary bg-primary/5 px-7 py-3.5">
            <View className="mb-3 flex-row items-center justify-between">
              <Input
                value={item.name}
                onChangeText={(text) => onUpdateField(index, 'name', text)}
                className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-lg font-semibold shadow-none"
                placeholder={t.scan_itemName}
                placeholderTextColor={iconColors.mutedLight}
                autoFocus
              />
              <Pressable onPress={onDismissEdit} className="ml-3 rounded-full bg-destructive/15 px-3 py-1">
                <Text className="text-sm font-semibold text-destructive">{t.cancel}</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
                <Input
                  value={String(item.quantity)}
                  onChangeText={(text) => onUpdateField(index, 'quantity', text)}
                  className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-base font-medium shadow-none"
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-[2]">
                <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
                <Input
                  value={formatCurrency(item.unitPrice, country)}
                  onChangeText={(text) => onUpdateField(index, 'unitPrice', text)}
                  className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-base font-medium shadow-none"
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-[2]">
                <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
                <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                  <Text className="text-base font-bold text-primary">
                    {formatCurrency(item.subtotal, country)}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable onPress={onDismissEdit} className="mt-3 items-center rounded-lg bg-primary/10 py-2">
              <Text className="text-base font-semibold text-primary">{t.done}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="bg-background">
            <Pressable
              onPress={() => onPress(index)}
              className="flex-row items-center px-7 py-3 active:bg-muted/30"
            >
              <View className="mr-3 flex-1">
                <Text className="text-lg font-semibold leading-5 text-foreground" numberOfLines={1}>
                  {item.name || t.scan_unnamed}
                </Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice, country)}
                </Text>
              </View>
              <Text className="mr-1.5 text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(item.subtotal, country)}
              </Text>
              <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
            </Pressable>
            {!isLast && <View className="ml-7 h-px bg-border/40" />}
          </View>
        )}
      </ReanimatedSwipeable>
    </SwipeableItem>
  );
}

export default React.memo(ReviewItemRow);
