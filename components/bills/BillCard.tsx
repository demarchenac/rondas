import React from 'react';
import { Image, Pressable, View } from 'react-native';
import type { Doc } from '@/convex/_generated/dataModel';
import { Text } from '@/components/ui/text';
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
      style={{ borderLeftWidth: 3, borderLeftColor: stateStyle.color }}
      className="rounded-xl bg-card px-4 py-3.5 active:opacity-80"
    >
      {/* Top row: name + badge */}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {bill.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: stateStyle.bg,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stateStyle.color }} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: stateStyle.color }}>
            {label}
          </Text>
        </View>
      </View>

      {/* Bottom row: amount + meta */}
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(bill.total, bill.country)}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {relativeTime(bill._creationTime)} · {t.billCard_items(itemCount)}
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
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    marginLeft: i > 0 ? -8 : 0,
                    borderWidth: 2,
                    borderColor: '#1a2540',
                  }}
                />
              ) : (
                <View
                  key={i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: stateStyle.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: i > 0 ? -8 : 0,
                    borderWidth: 2,
                    borderColor: '#1a2540',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: stateStyle.color }}>
                    {c.name[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )
            ))}
            {contactCount > 3 && (
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: 'rgba(148,163,184,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: -8,
                  borderWidth: 2,
                  borderColor: '#1a2540',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#8b9cc0' }}>
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
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(148,163,184,0.15)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: stateStyle.color,
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: '#8b9cc0', marginTop: 3 }}>
            {t.billCard_assigned(assignedItems, itemCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default React.memo(BillCard);
