import React from 'react';
import { Image, Pressable, View } from 'react-native';
import type { ResolvedBill } from '@/lib/filters';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AnimatedBadge from '@/components/bills/AnimatedBadge';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { relativeTime } from '@/lib/date';
import { STATE_STYLES, stateLabel, type BillState } from '@/lib/billHelpers';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import type { Translations } from '@/lib/i18n';

type Bill = ResolvedBill;

export interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  t: Translations;
}

const CATEGORY_ICONS: Record<string, 'fork.knife' | 'cart' | 'wrench.adjustable'> = {
  dining: 'fork.knife',
  retail: 'cart',
  service: 'wrench.adjustable',
};

function BillCard({ bill, onPress, t }: BillCardProps) {
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const stateStyle = STATE_STYLES[bill.state as BillState];
  const label = stateLabel(t, bill.state as BillState);
  const contactCount = bill.contacts.length;
  const itemCount = bill.items.length;
  const assignedItems = bill.state !== 'unsplit' && bill.state !== 'draft'
    ? new Set(bill.contacts.flatMap((c) => c.items)).size
    : 0;
  const progress = itemCount > 0 ? assignedItems / itemCount : 0;
  const isDraft = bill.state === 'draft';

  const categoryIcon = bill.category ? CATEGORY_ICONS[bill.category] : null;
  const paidCount = bill.contacts.filter((c) => c.paid).length;

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-xl border-l-[3px] bg-card px-4 py-3 active:opacity-80',
        stateStyle.borderClass,
        isDraft && 'opacity-60',
        bill.state === 'unresolved' && 'bg-amber-500/[0.03]',
      )}
    >
      {/* Top row: category icon + name + badge */}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          {categoryIcon && (
            <IconSymbol name={categoryIcon} size={14} color={iconColors.muted} />
          )}
          <Text className={cn('flex-1 font-bold text-foreground', isDraft ? 'text-sm' : 'text-sm')} numberOfLines={1}>
            {bill.name}
          </Text>
        </View>
        <AnimatedBadge variant={bill.state as BillState} label={label} />
      </View>

      {/* Amount */}
      <Text className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
        {formatCurrency(bill.total, bill.country)}
      </Text>

      {/* Meta row: time + items + contacts */}
      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {relativeTime(bill._creationTime, t)} · {t.billCard_items(itemCount)}
        </Text>

        {contactCount > 0 && (
          <View className="flex-row items-center gap-2">
            {/* Unpaid indicator */}
            {bill.state === 'unresolved' && (
              <Text className="text-[10px] font-semibold text-amber-500">
                {paidCount}/{contactCount}
              </Text>
            )}
            {/* Contact avatars */}
            <View className="flex-row items-center">
              {bill.contacts.slice(0, 3).map((c, i) => (
                c.imageUri ? (
                  <Image
                    key={i}
                    source={{ uri: c.imageUri }}
                    className={cn('h-[26px] w-[26px] rounded-full border-2 border-card', i > 0 && '-ml-2')}
                  />
                ) : (
                  <View
                    key={i}
                    className={cn('h-[26px] w-[26px] rounded-full items-center justify-center border-2 border-card', stateStyle.bgClass, i > 0 && '-ml-2')}
                  >
                    <Text className={cn('text-[10px] font-bold', stateStyle.textClass)}>
                      {c.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )
              ))}
              {contactCount > 3 && (
                <View className="-ml-2 h-[26px] w-[26px] rounded-full items-center justify-center border-2 border-card bg-muted-foreground/15">
                  <Text className="text-[9px] font-bold text-muted-foreground">
                    +{contactCount - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Progress bar for unresolved bills (no text — bar is sufficient) */}
      {bill.state === 'unresolved' && itemCount > 0 && (
        <View className="mt-2">
          <View className="h-[3px] rounded-sm bg-muted-foreground/15 overflow-hidden">
            <View
              className={cn('h-full rounded-sm', stateStyle.progressClass)}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default React.memo(BillCard);
