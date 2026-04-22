import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBufferedInput } from '@/hooks/useBufferedInput';
import { useCustomAlert } from '@/components/ui/custom-alert';
import AnimatedBadge from '@/components/bills/AnimatedBadge';
import type { BillState } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

interface BillHeaderProps {
  billName: string;
  state: BillState;
  stateLabel: string;
  completionPercent: number;
  paidPercent: number;
  unpaidPercent: number;
  stateTextClass: string;
  hasContacts: boolean;
  splitStrategy?: string;
  multiSelectMode: boolean;
  iconColors: Record<string, string>;
  t: Translations;
  onBack: () => void;
  onUpdateName: (name: string) => void;
  onDelete: () => Promise<void>;
  onSplitEqually?: () => void;
  onSplitByItem?: () => void;
  onEdit: () => void;
  onDoneEdit: () => void;
}

function BillHeader({
  billName,
  state,
  stateLabel,
  completionPercent,
  paidPercent,
  unpaidPercent,
  stateTextClass,
  hasContacts,
  splitStrategy,
  multiSelectMode,
  iconColors,
  t,
  onBack,
  onUpdateName,
  onDelete,
  onSplitEqually,
  onSplitByItem,
  onEdit,
  onDoneEdit,
}: BillHeaderProps) {
  const nameInput = useBufferedInput(billName, onUpdateName);
  const { alert, actionSheet } = useCustomAlert();

  const handleOverflowPress = () => {
    const options: { label: string; action: () => void; destructive?: boolean }[] = [];

    options.push({ label: t.bill_edit, action: onEdit });

    if (state !== 'draft' && splitStrategy !== 'equal' && onSplitEqually) {
      options.push({ label: t.bill_splitEqual, action: onSplitEqually });
    }
    if (splitStrategy === 'equal' && onSplitByItem) {
      options.push({ label: t.bill_splitByItem, action: onSplitByItem });
    }
    options.push({ label: t.bill_deleteBill, action: () => confirmDelete(), destructive: true });

    const labels = [...options.map((o) => o.label), t.cancel];
    const destructiveIndex = options.findIndex((o) => o.destructive);
    actionSheet({
      options: labels,
      destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
      cancelButtonIndex: labels.length - 1,
      onSelect: (index) => {
        if (index < options.length) options[index].action();
      },
    });
  };

  const confirmDelete = () => {
    alert(
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
      {/* Single row: Back + title + overflow/done + badge */}
      <View className="flex-row items-center">
        <Pressable onPress={onBack} className="pr-2 active:opacity-80">
          <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
        </Pressable>
        <TextInput
          value={nameInput.value}
          onChangeText={nameInput.onChangeText}
          onFocus={nameInput.onFocus}
          onBlur={nameInput.onBlur}
          className="flex-1 text-lg font-bold text-foreground"
          style={{ padding: 0, margin: 0, lineHeight: 18, height: 22 }}
        />
        <View className="flex-row items-center gap-2 ml-2">
          {hasContacts && !multiSelectMode && (
            <Text className={`text-xs font-semibold ${stateTextClass}`}>
              {Math.round(completionPercent)}%
            </Text>
          )}
          {!multiSelectMode && <AnimatedBadge variant={state} label={stateLabel} />}
          {multiSelectMode ? (
            <Pressable
              onPress={onDoneEdit}
              className="rounded-full bg-primary px-3.5 py-1.5 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-primary-foreground">{t.done}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleOverflowPress}
              className="h-8 w-8 items-center justify-center rounded-full bg-muted/50 active:opacity-80"
            >
              <IconSymbol name="ellipsis" size={16} color={iconColors.muted} />
            </Pressable>
          )}
        </View>
      </View>
      {/* Progress bar */}
      {hasContacts && !multiSelectMode && (
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
