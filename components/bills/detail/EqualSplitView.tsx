import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Avatar from '@/components/ui/avatar';
import SwipeableRow from '@/components/bills/SwipeableRow';
import CurrencyInput from '@/components/form/CurrencyInput';
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
  isSelf?: boolean;
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
  editingItemId: string | null;
  onNumPeopleChange: (n: number) => void;
  onAssignContacts: () => void;
  onConfirm: () => void;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
  onRemoveContact: (contactId: Id<'contacts'>) => void;
  onItemPress: (itemId: string) => void;
  onSubmitEdit: (itemId: string, values: { name: string; quantity: number; unitPrice: number }) => void;
  onDismissEdit: () => void;
  onRemoveItem: (itemId: string) => void;
}

function EqualSplitItemEdit({
  item,
  billCountry,
  t,
  onSubmit,
  onCancel,
}: {
  item: BillItem;
  billCountry: string;
  t: Translations;
  onSubmit: (values: { name: string; quantity: number; unitPrice: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);

  const qty = parseInt(quantity, 10) || 0;
  const subtotal = qty * unitPrice;

  return (
    <View className="my-1 border-l-[3px] border-l-primary py-3 pl-3 pr-1">
      {/* Name input */}
      <Input
        value={name}
        onChangeText={setName}
        className={`mb-3 rounded-lg border-border bg-card text-[15px] font-semibold ${Platform.OS === 'ios' ? 'h-10' : ''}`}
        placeholder={t.scan_itemName}
        autoFocus
      />

      {/* Quantity + Unit Price row */}
      <View className="mb-3 flex-row gap-3">
        <View className="w-20">
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.scan_qty}
          </Text>
          <Input
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            className={`rounded-lg border-border bg-card text-center text-sm ${Platform.OS === 'ios' ? 'h-10' : ''}`}
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.scan_unitPrice}
          </Text>
          <CurrencyInput
            value={unitPrice}
            onChangeValue={setUnitPrice}
            country={billCountry}
            className={`rounded-lg border border-border bg-card px-3 text-sm ${Platform.OS === 'ios' ? 'h-10' : ''}`}
          />
        </View>
      </View>

      {/* Subtotal + Actions */}
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.scan_subtotal}
          </Text>
          <Text className="text-base font-bold tabular-nums text-foreground">
            {formatCurrency(subtotal, billCountry)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={onCancel}
            className="rounded-lg bg-muted px-4 py-2 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSubmit({ name, quantity: parseInt(quantity, 10) || 1, unitPrice });
            }}
            className="rounded-lg bg-primary px-4 py-2 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-primary-foreground">{t.done}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EqualSplitView({
  items,
  contacts,
  total,
  numPeople,
  billCountry,
  iconColors,
  t,
  editingItemId,
  onNumPeopleChange,
  onAssignContacts,
  onConfirm,
  onTogglePaid,
  onRemoveContact,
  onItemPress,
  onSubmitEdit,
  onDismissEdit,
  onRemoveItem,
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

  const handleRemoveSlot = (index: number) => {
    const contact = contacts[index];
    if (contact) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRemoveContact(contact.contactId);
    } else if (numPeople > 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onNumPeopleChange(numPeople - 1);
    }
  };

  const slots = Array.from({ length: numPeople }, (_, i) => contacts[i] ?? null);

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

      {/* People slots — contacts + placeholders */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} className="rounded-2xl border border-border bg-card p-4">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {contacts.length}/{numPeople} {t.bill_equalPeople.toLowerCase()}
        </Text>
        <View className="gap-1">
          {slots.map((contact, i) => (
            <SwipeableRow key={contact ? String(contact.contactId) : `placeholder-${i}`} onDelete={() => handleRemoveSlot(i)} bgClassName="bg-card">
              <View className="flex-row items-center gap-3 py-1.5">
                {contact ? (
                  <>
                    <Avatar name={contact.name} imageUri={contact.imageUri} size="md" />
                    <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                      {contact.isSelf ? t.self_label(contact.name) : contact.name}
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
                  </>
                ) : (
                  <Pressable onPress={onAssignContacts} className="flex-1 flex-row items-center gap-3 active:opacity-80">
                    <View className="h-9 w-9 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
                      <IconSymbol name="person.crop.circle" size={16} color={iconColors.muted} />
                    </View>
                    <Text className="flex-1 text-sm text-muted-foreground">
                      {t.bill_persona(i + 1)}
                    </Text>
                    <Text className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(i === 0 ? perPerson + remainder : perPerson, billCountry)}
                    </Text>
                  </Pressable>
                )}
              </View>
            </SwipeableRow>
          ))}
        </View>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} className="gap-2">
        {contacts.length < numPeople && (
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
        )}
      </Animated.View>

      {/* Items — compact with tap-to-edit */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} className="rounded-2xl border border-border bg-card p-4">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.scan_itemCount(items.length)}
        </Text>
        {items.map((item, i) => {
          const itemId = item.id!;
          return editingItemId === itemId ? (
            <EqualSplitItemEdit
              key={itemId}
              item={item}
              billCountry={billCountry}
              t={t}
              onSubmit={(values) => onSubmitEdit(itemId, values)}
              onCancel={onDismissEdit}
            />
          ) : (
            <SwipeableRow key={itemId} onDelete={() => onRemoveItem(itemId)} bgClassName="bg-card">
              <Pressable
                onPress={() => onItemPress(itemId)}
                className={cn('flex-row items-center justify-between py-2 active:opacity-80', i < items.length - 1 && 'border-b border-border')}
              >
                <View className="flex-1 mr-2">
                  <Text className="text-sm text-foreground" numberOfLines={1}>{item.name || t.scan_itemName}</Text>
                  {item.quantity > 1 && (
                    <Text className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unitPrice, billCountry)}
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(item.subtotal, billCountry)}
                  </Text>
                  <IconSymbol name="pencil.line" size={11} color={iconColors.muted} />
                </View>
              </Pressable>
            </SwipeableRow>
          );
        })}
      </Animated.View>
    </View>
  );
}

export default React.memo(EqualSplitView);
