import React from 'react';
import { Image, Pressable, View } from 'react-native';
import type { Doc } from '@/convex/_generated/dataModel';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { relativeTime } from '@/lib/date';
import { STATE_STYLES, stateLabel, type BillState } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

type Bill = Doc<'bills'>;

export interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  t: Translations;
}

function BillCard({ bill, onPress, t }: BillCardProps) {
  const stateStyle = STATE_STYLES[bill.state as BillState];
  const label = stateLabel(t, bill.state as BillState);
  const contactCount = bill.contacts.length;
  const itemCount = bill.items.length;
  const assignedItems = bill.state !== 'unsplit' && bill.state !== 'draft'
    ? new Set(bill.contacts.flatMap((c) => c.items)).size
    : 0;
  const progress = itemCount > 0 ? assignedItems / itemCount : 0;

  return (
    <Pressable
      onPress={onPress}
      className={cn('rounded-xl border-l-[3px] bg-card px-4 py-3.5 active:opacity-80', stateStyle.borderClass)}
    >
      {/* Top row: name + badge */}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {bill.name}
        </Text>
        <Badge variant={bill.state as BillState}>
          <Text>{label}</Text>
        </Badge>
      </View>

      {/* Bottom row: amount + meta */}
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(bill.total, bill.country)}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {relativeTime(bill._creationTime, t)} · {t.billCard_items(itemCount)}
          </Text>
        </View>

        {/* Contact avatars or item count */}
        {contactCount > 0 ? (
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
              <View
                className="-ml-2 h-[26px] w-[26px] rounded-full items-center justify-center border-2 border-card bg-muted-foreground/15"
              >
                <Text className="text-[9px] font-bold text-muted-foreground">
                  +{contactCount - 3}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Progress bar for unresolved bills */}
      {bill.state === 'unresolved' && itemCount > 0 && (
        <View className="mt-2.5">
          <View className="h-[3px] rounded-sm bg-muted-foreground/15 overflow-hidden">
            <View
              className={cn('h-full rounded-sm', stateStyle.progressClass)}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
          <Text className="mt-[3px] text-[10px] text-muted-foreground">
            {t.billCard_assigned(assignedItems, itemCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default React.memo(BillCard);
