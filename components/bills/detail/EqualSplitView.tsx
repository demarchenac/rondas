import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from '@/lib/expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Id } from '@/convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';

interface BillItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ResolvedContact {
  contactId: Id<'contacts'>;
  name: string;
  phone?: string;
  imageUri?: string;
  items: string[];
  amount: number;
  paid: boolean;
}

interface EqualSplitViewProps {
  items: BillItem[];
  contacts: ResolvedContact[];
  total: number;
  numPeople: number;
  billCountry: string;
  iconColors: Record<string, string>;
  t: Translations;
  onNumPeopleChange: (n: number) => void;
  onAssignContacts: () => void;
  onConfirm: () => void;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
}

function EqualSplitView({
  items,
  contacts,
  total,
  numPeople,
  billCountry,
  iconColors,
  t,
  onNumPeopleChange,
  onAssignContacts,
  onConfirm,
  onTogglePaid,
}: EqualSplitViewProps) {
  const perPerson = Math.floor(total / numPeople);
  const remainder = total - perPerson * numPeople;

  const handleDecrement = () => {
    if (numPeople <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNumPeopleChange(numPeople - 1);
  };

  const handleIncrement = () => {
    if (numPeople >= 20) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNumPeopleChange(numPeople + 1);
  };

  return (
    <View className="gap-4">
      {/* People stepper */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="rounded-2xl border border-border bg-card p-5">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.bill_equalPeople}
        </Text>
        <View className="flex-row items-center justify-center gap-6">
          <Pressable
            onPress={handleDecrement}
            disabled={numPeople <= 2}
            className={cn('active:opacity-80', numPeople <= 2 && 'opacity-30')}
          >
            <IconSymbol name="minus.circle.fill" size={36} color={iconColors.primary} />
          </Pressable>
          <Text className="min-w-[48px] text-center text-4xl font-bold tabular-nums text-foreground">
            {numPeople}
          </Text>
          <Pressable
            onPress={handleIncrement}
            disabled={numPeople >= 20}
            className={cn('active:opacity-80', numPeople >= 20 && 'opacity-30')}
          >
            <IconSymbol name="plus.circle.fill" size={36} color={iconColors.primary} />
          </Pressable>
        </View>
        <View className="mt-3 items-center">
          <Text className="text-2xl font-bold text-primary">
            {formatCurrency(perPerson + (remainder > 0 ? 1 : 0), billCountry)}
          </Text>
          <Text className="text-sm text-muted-foreground">{t.bill_equalPerPerson}</Text>
          {remainder > 0 && (
            <Text className="mt-1 text-xs text-muted-foreground">
              {t.bill_equalRemainder(formatCurrency(remainder, billCountry))}
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Assigned contacts */}
      {contacts.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="rounded-2xl border border-border bg-card p-4">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {contacts.length}/{numPeople} {t.bill_equalPeople.toLowerCase()}
          </Text>
          <View className="gap-2">
            {contacts.map((contact, i) => (
              <View key={String(contact.contactId)} className="flex-row items-center gap-3">
                {contact.imageUri ? (
                  <Image source={{ uri: contact.imageUri }} className="h-8 w-8 rounded-full" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Text className="text-sm font-bold" style={{ color: iconColors.primary }}>
                      {contact.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(i === 0 ? perPerson + remainder : perPerson, billCountry)}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onTogglePaid(contact.contactId);
                  }}
                  className={cn(
                    'rounded-full px-2.5 py-1',
                    contact.paid ? 'bg-emerald-500/15' : 'bg-muted-foreground/10',
                  )}
                >
                  <Text className={cn('text-xs font-semibold', contact.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {contact.paid ? t.share_paid : t.share_unpaid}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} className="gap-2">
        <Button variant="outline" onPress={onAssignContacts}>
          <View className="flex-row items-center gap-2">
            <IconSymbol name="person.badge.plus" size={16} color={iconColors.primary} />
            <Text className="text-sm font-semibold text-primary">
              {contacts.length > 0
                ? t.contactPicker_assign(numPeople - contacts.length)
                : t.contactPicker_title}
            </Text>
          </View>
        </Button>
        {contacts.length > 0 && (
          <Button onPress={onConfirm}>
            <Text className="text-sm font-bold text-primary-foreground">{t.bill_equalConfirm}</Text>
          </Button>
        )}
      </Animated.View>

      {/* Read-only items list */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} className="rounded-2xl border border-border bg-card p-4">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.scan_itemCount(items.length)}
        </Text>
        {items.map((item, i) => (
          <View key={item.id ?? i} className={cn('flex-row items-center justify-between py-2', i < items.length - 1 && 'border-b border-border/40')}>
            <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{item.name}</Text>
            <Text className="ml-2 text-sm tabular-nums text-muted-foreground">
              {formatCurrency(item.subtotal, billCountry)}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default React.memo(EqualSplitView);
