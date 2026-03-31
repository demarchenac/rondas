import React from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AnimatedBadge from '@/components/bills/AnimatedBadge';
import type { BillState } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

interface BillHeaderProps {
  billName: string;
  state: BillState;
  stateLabel: string;
  paidPercent: number;
  unpaidPercent: number;
  hasContacts: boolean;
  iconColors: Record<string, string>;
  t: Translations;
  onBack: () => void;
  onUpdateName: (name: string) => void;
  onDelete: () => Promise<void>;
}

function BillHeader({
  billName,
  state,
  stateLabel,
  paidPercent,
  unpaidPercent,
  hasContacts,
  iconColors,
  t,
  onBack,
  onUpdateName,
  onDelete,
}: BillHeaderProps) {
  const handleOverflowPress = () => {
    Alert.alert(
      t.bill_deleteBill,
      t.bill_deleteConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await onDelete();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  return (
    <View className="px-7 pb-3 pt-3">
      {/* Single row: Back + title + overflow + badge */}
      <View className="flex-row items-center">
        <Pressable onPress={onBack} className="py-1 pr-2 active:opacity-80">
          <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
        </Pressable>
        <TextInput
          value={billName}
          onChangeText={onUpdateName}
          className="flex-1 px-0 py-0 text-lg font-bold text-foreground"
        />
        <View className="flex-row items-center gap-2 ml-2">
          <Pressable
            onPress={handleOverflowPress}
            className="h-8 w-8 items-center justify-center rounded-full bg-muted/50 active:opacity-80"
          >
            <IconSymbol name="ellipsis" size={16} color={iconColors.muted} />
          </Pressable>
          <AnimatedBadge variant={state} label={stateLabel} />
        </View>
      </View>
      {/* Progress bar */}
      {hasContacts && (
        <View className="mt-2 h-1 overflow-hidden rounded-full bg-muted flex-row">
          {paidPercent > 0 && (
            <View className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} />
          )}
          {unpaidPercent > 0 && (
            <View className="h-full bg-amber-500" style={{ width: `${unpaidPercent}%` }} />
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(BillHeader);
