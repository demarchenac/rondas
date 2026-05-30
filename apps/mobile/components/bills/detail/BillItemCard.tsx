import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Image } from '@/lib/expo-image';
import SwipeableRow from '@/components/bills/SwipeableRow';
import { useForm } from '@tanstack/react-form';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { formatCurrency, parseCurrency } from '@/lib/format';
import CurrencyInput from '@/components/form/CurrencyInput';
import SwipeableItem from '@/components/bills/SwipeableItem';
import type { Id } from '@convex/_generated/dataModel';
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
  isSelf?: boolean;
  name: string;
  phone?: string;
  imageUri?: string;
  items: { itemId: string; units: number }[];
  amount: number;
  paid: boolean;
}

interface BillItemCardProps {
  item: BillItem;
  index: number;
  billCountry: string;
  stateStyle: { borderClass: string; color: string };
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
  onSubmitEdit: (itemId: string, values: { name: string; quantity: number; unitPrice: number }) => void;
  onDismissEdit: () => void;
  onAssignContact: (itemId: string) => void;
  onRemoveContact: (itemId: string, contactId: Id<'contacts'>) => void;
  onContactPress: (itemId: string, contactId: Id<'contacts'>) => void;
  decimalPlaces?: number;
  onToggleSelection: (itemId: string) => void;
}

const PAID_COLORS = { bg: '#10b9811A', border: '#10b98133', text: '#10b981', badge: '#10b98133' };

function getUnpaidColors(primary: string) {
  return { bg: `${primary}1A`, border: `${primary}33`, text: primary, badge: `${primary}33` };
}


function ContactChip({ contact, units, itemId, iconColors, t, onPress }: {
  contact: AssignedContact;
  units: number;
  itemId: string;
  iconColors: Record<string, string>;
  t: Translations;
  onPress: (itemId: string, contactId: Id<'contacts'>) => void;
}) {
  const unpaidColors = getUnpaidColors(iconColors.primary);
  const colors = contact.paid ? PAID_COLORS : unpaidColors;
  const chipWidth = useSharedValue(0);
  const overlayWidth = useSharedValue(0);
  const [overlayBg, setOverlayBg] = useState<string | null>(null);
  const [prevPaid, setPrevPaid] = useState(contact.paid);
  if (contact.paid !== prevPaid) {
    const oldBg = prevPaid ? PAID_COLORS.bg : unpaidColors.bg;
    setPrevPaid(contact.paid);
    setOverlayBg(oldBg);
    overlayWidth.value = chipWidth.value;
    overlayWidth.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) });
  }

  const overlayStyle = useAnimatedStyle(() => ({
    width: overlayWidth.value,
  }));

  return (
    <Pressable onPress={() => onPress(itemId, contact.contactId)}>
      <View
        onLayout={(e) => { chipWidth.value = e.nativeEvent.layout.width; }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderRadius: 9999, borderColor: colors.border, backgroundColor: colors.bg, overflow: 'hidden' }}
      >
        {overlayBg && <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: overlayBg }, overlayStyle]} />}
        {contact.imageUri ? (
          <Image source={{ uri: contact.imageUri }} style={{ width: 16, height: 16, borderRadius: 8 }} />
        ) : (
          <IconSymbol name="person.crop.circle" size={13} color={colors.text} />
        )}
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
          {contact.isSelf ? t.self_label(contact.name) : contact.name}
        </Text>
        {units > 1 && (
          <View style={{ backgroundColor: colors.badge, borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>x{units}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function BillItemEditForm({
  item,
  billCountry,
  decimalPlaces,
  iconColors,
  t,
  onSubmit,
  onCancel,
}: {
  item: BillItem;
  billCountry: string;
  decimalPlaces?: number;
  iconColors: Record<string, string>;
  t: Translations;
  onSubmit: (values: { name: string; quantity: number; unitPrice: number }) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      name: item.name,
      quantity: String(item.quantity),
      unitPrice: formatCurrency(item.unitPrice, billCountry),
    },
    onSubmit: ({ value }) => {
      const qty = parseInt(value.quantity, 10) || item.quantity;
      const price = parseCurrency(value.unitPrice, billCountry);
      onSubmit({ name: value.name, quantity: qty, unitPrice: price });
    },
  });

  const qty = parseInt(form.state.values.quantity, 10) || 0;
  const price = parseCurrency(form.state.values.unitPrice, billCountry);
  const subtotal = qty * price;

  return (
    <View className={cn('mx-7 mb-2.5 rounded-xl border-l-[3px] border-l-primary bg-primary/5 px-4 py-3.5')}>
      <View className="mb-3 flex-row items-center justify-between">
        <form.Field name="name">
          {(field) => (
            <Input
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-lg font-semibold shadow-none"
              placeholder={t.scan_itemName}
              autoFocus
            />
          )}
        </form.Field>
        <Pressable onPress={onCancel} className="ml-3 rounded-full bg-destructive/15 px-3 py-1">
          <Text className="text-sm font-semibold text-destructive">{t.cancel}</Text>
        </Pressable>
      </View>
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
          <form.Field name="quantity">
            {(field) => (
              <Input
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                className={`rounded-lg border-0 bg-muted px-3 text-base font-medium shadow-none ${Platform.OS === 'ios' ? 'h-9' : ''}`}
                keyboardType="number-pad"
              />
            )}
          </form.Field>
        </View>
        <View className="flex-[2]">
          <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
          <form.Field name="unitPrice">
            {(field) => (
              <CurrencyInput
                value={parseCurrency(field.state.value, billCountry)}
                onChangeValue={(n) => field.handleChange(formatCurrency(n, billCountry, decimalPlaces))}
                onBlur={field.handleBlur}
                country={billCountry}
                decimalPlaces={decimalPlaces}
                className={`rounded-lg border-0 bg-muted px-3 text-base font-medium shadow-none ${Platform.OS === 'ios' ? 'h-9' : ''}`}
              />
            )}
          </form.Field>
        </View>
        <View className="flex-[2]">
          <Text className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
          <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
            <Text className="text-base font-bold text-primary">
              {formatCurrency(subtotal, billCountry)}
            </Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => form.handleSubmit()}
        className="mt-3 items-center rounded-lg bg-primary/10 py-2"
      >
        <Text className="text-base font-semibold text-primary">{t.done}</Text>
      </Pressable>
    </View>
  );
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
  onSubmitEdit,
  onDismissEdit,
  onAssignContact,
  decimalPlaces,
  onRemoveContact,
  onContactPress,
  onToggleSelection,
}: BillItemCardProps) {
  const itemId = item.id!;
  const hasContacts = assignedContacts.length > 0;
  const allPaid = hasContacts && assignedContacts.every((c) => c.paid);
  const targetColor = !hasContacts
    ? 'rgba(148,163,184,0.2)'
    : allPaid
      ? '#10b981'
      : stateStyle.color;

  const displayColor = useSharedValue(targetColor);
  const borderW = useSharedValue(3);
  const [prevTargetColor, setPrevTargetColor] = useState(targetColor);
  if (targetColor !== prevTargetColor) {
    setPrevTargetColor(targetColor);
    borderW.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        displayColor.value = targetColor;
        borderW.value = withTiming(3, { duration: 300 });
      }
    });
  }

  const borderStyle = useAnimatedStyle(() => ({
    width: borderW.value,
    backgroundColor: displayColor.value,
  }));

  return (
    <SwipeableItem isDeleting={isDeleting}>
      <SwipeableRow
        onDelete={() => onRemoveItem(itemId)}
        onSwipeStart={() => { swipeOpenRef.current = true; }}
      >
        {isEditing ? (
          <BillItemEditForm
            item={item}
            billCountry={billCountry}
            decimalPlaces={decimalPlaces}
            iconColors={iconColors}
            t={t}
            onSubmit={(values) => onSubmitEdit(itemId, values)}
            onCancel={onDismissEdit}
          />
        ) : (
          /* Display mode */
          <Pressable
            onPress={() => multiSelectMode ? onToggleSelection(itemId) : onPress(itemId)}
            className="mx-7 mb-2.5 overflow-hidden rounded-xl bg-card pr-4 py-3 active:opacity-80"
            style={{ paddingLeft: 19 }}
          >
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, overflow: 'hidden' }}>
              <Animated.View
                style={[{
                  position: 'absolute',
                  right: 0, top: 0, bottom: 0,
                  borderTopLeftRadius: 12,
                  borderBottomLeftRadius: 12,
                }, borderStyle]}
              />
            </View>
            {/* Top row: name/qty + price/button */}
            <View className="flex-row items-start">
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
                <View className="flex-row items-center gap-1">
                  <Text className="shrink text-lg font-semibold leading-5 text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!multiSelectMode && (
                    <IconSymbol name="pencil.line" size={11} color={iconColors.mutedLight} />
                  )}
                </View>
                <Text className="mt-0.5 text-sm text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice, billCountry, decimalPlaces)}
                </Text>
                {/* Assign hint */}
                {!hasContacts && !multiSelectMode && item.subtotal >= 0 && (
                  <Text className="mt-1.5 text-sm text-muted-foreground/40">{t.bill_tapToAssign}</Text>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <Text className={cn(
                  'text-lg font-bold tabular-nums',
                  item.subtotal < 0 ? 'text-emerald-500' : 'text-foreground',
                )}>
                  {formatCurrency(item.subtotal, billCountry, decimalPlaces)}
                </Text>
                {!multiSelectMode && item.subtotal >= 0 && (
                  <Pressable
                    onPress={() => onAssignContact(itemId)}
                    className="h-7 w-7 items-center justify-center rounded-full border border-dashed border-primary/30 bg-primary/5"
                  >
                    <IconSymbol name="plus" size={12} color={iconColors.primary} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Contact chips — full width below the top row */}
            {hasContacts && (
              <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                {assignedContacts.map((c) => {
                  const ref = c.items.find((i) => i.itemId === item.id);
                  const units = ref?.units ?? 1;
                  return (
                    <ContactChip
                      key={String(c.contactId)}
                      contact={c}
                      units={units}
                      itemId={itemId}
                      iconColors={iconColors}
                      t={t}
                      onPress={onContactPress}
                    />
                  );
                })}
              </View>
            )}
          </Pressable>
        )}
      </SwipeableRow>
    </SwipeableItem>
  );
}

export default React.memo(BillItemCard);
