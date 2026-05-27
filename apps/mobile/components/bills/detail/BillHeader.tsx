import React, { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';

import Skeleton from '@/components/ui/Skeleton';
import { useBufferedInput } from '@/hooks/useBufferedInput';
import { useCustomAlert } from '@/components/ui/custom-alert';
import AnimatedBadge from '@/components/bills/AnimatedBadge';
import { STATE_STYLES, type BillState } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

function HeaderSkeleton({ hasProgressBar }: { hasProgressBar: boolean }) {
  return (
    <View className="px-5 pb-3 pt-3">
      <View className="flex-row items-center gap-3">
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width="60%" height={20} borderRadius={6} />
        <Skeleton width={60} height={28} borderRadius={14} />
        <Skeleton width={76} height={28} borderRadius={14} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      {hasProgressBar && (
        <View style={{ marginTop: 10 }}>
          <Skeleton width="100%" height={6} borderRadius={3} />
        </View>
      )}
    </View>
  );
}

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

  const glassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const [glassReady, setGlassReady] = useState(false);
  useEffect(() => {
    if (glassAvailable && !glassReady) {
      const id = setTimeout(() => setGlassReady(true), 500);
      return () => clearTimeout(id);
    }
  }, [glassAvailable, glassReady]);
  const useGlass = glassAvailable && glassReady;

  const stateStyle = STATE_STYLES[state];

  const handleOverflowPress = () => {
    const options: { label: string; action: () => void; destructive?: boolean }[] = [];

    if (splitStrategy !== 'equal') {
      options.push({ label: t.bill_edit, action: onEdit });
    }

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

  const backButton = useGlass ? (
    <Pressable onPress={onBack} className="active:opacity-80">
      <GlassView isInteractive style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="chevron.left" size={18} color={iconColors.primary} />
        </GlassView>
    </Pressable>
  ) : (
    <Pressable onPress={onBack} className="pr-2 active:opacity-80">
      <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
    </Pressable>
  );

  const percentChip = hasContacts && !multiSelectMode ? (
    useGlass ? (
      <GlassView style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text className={`text-sm font-semibold ${stateTextClass}`}>
            {Math.round(completionPercent)}%
          </Text>
        </GlassView>
    ) : (
      <Text className={`text-sm font-semibold ${stateTextClass}`}>
        {Math.round(completionPercent)}%
      </Text>
    )
  ) : null;

  const statusBadge = !multiSelectMode ? (
    useGlass ? (
      <GlassView style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stateStyle.color }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: stateStyle.color }}>
            {stateLabel}
          </Text>
        </GlassView>
    ) : (
      <AnimatedBadge variant={state} label={stateLabel} />
    )
  ) : null;

  const overflowButton = multiSelectMode ? (
    <Pressable
      onPress={onDoneEdit}
      className="rounded-full bg-primary px-3.5 py-1.5 active:opacity-80"
    >
      <Text className="text-sm font-semibold text-primary-foreground">{t.done}</Text>
    </Pressable>
  ) : useGlass ? (
    <Pressable onPress={handleOverflowPress} className="active:opacity-80">
      <GlassView isInteractive style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="ellipsis" size={16} color={iconColors.muted} />
        </GlassView>
    </Pressable>
  ) : (
    <Pressable
      onPress={handleOverflowPress}
      className="h-8 w-8 items-center justify-center rounded-full bg-muted/50 active:opacity-80"
    >
      <IconSymbol name="ellipsis" size={16} color={iconColors.muted} />
    </Pressable>
  );

  if (glassAvailable && !glassReady) {
    return <HeaderSkeleton hasProgressBar={hasContacts && !multiSelectMode} />;
  }

  return (
    <View className="px-5 pb-3 pt-3">
      <View className="flex-row items-center">
        {backButton}
        <TextInput
          value={nameInput.value}
          onChangeText={nameInput.onChangeText}
          onFocus={nameInput.onFocus}
          onBlur={nameInput.onBlur}
          className="flex-1 text-xl font-bold text-foreground ml-2"
          style={{ padding: 0, margin: 0, lineHeight: 18, height: 22 }}
        />
        <View className="flex-row items-center gap-2 ml-2">
          {percentChip}
          {statusBadge}
          {overflowButton}
        </View>
      </View>
      {/* Progress bar */}
      {hasContacts && !multiSelectMode && (
        useGlass ? (
          <GlassView style={{ borderRadius: 4, height: 6, overflow: 'hidden', flexDirection: 'row', marginTop: 10 }}>
            {paidPercent > 0 && (
              <View style={{ height: '100%', backgroundColor: '#10b981', width: `${paidPercent}%`, borderRadius: 4 }} />
            )}
            {unpaidPercent > 0 && (
              <View style={{ height: '100%', backgroundColor: '#f59e0b', width: `${unpaidPercent}%` }} />
            )}
          </GlassView>
        ) : (
          <View className="mt-2 h-1 overflow-hidden rounded-full bg-muted flex-row">
            {paidPercent > 0 && (
              <View className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} />
            )}
            {unpaidPercent > 0 && (
              <View className="h-full bg-amber-500" style={{ width: `${unpaidPercent}%` }} />
            )}
          </View>
        )
      )}
    </View>
  );
}

export default React.memo(BillHeader);
