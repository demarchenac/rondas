import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, View , useColorScheme } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import type { ResolvedBill } from '@/lib/filters';
import { cn } from '@/lib/cn';
import { STATE_STYLES, stateLabel, type BillState } from '@/lib/billHelpers';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride } from '@/constants/taxes';
import { ICON_COLORS } from '@/constants/colors';
import { useGlassEffect } from '@/hooks/useGlassEffect';
import { buildGlowTheme, type ColorMode } from '@/lib/stateTheme';
import type { Translations } from '@/lib/i18n';
import { CornerGlow, CardContent } from '@/components/bills/BillCardParts';

type Bill = ResolvedBill;

export interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  t: Translations;
  locked?: boolean;
}

function BillCardIOS({
  bill,
  onPress,
  t,
  locked = false,
  stateStyle,
  label,
  isDraft,
  isUnresolved,
  displayTotal,
  itemCount,
  contactCount,
  paidCount,
  progress,
  iconColors,
  hasUnassignedItems,
  mode,
}: BillCardProps & {
  stateStyle: (typeof STATE_STYLES)[BillState];
  label: string;
  isDraft: boolean;
  isUnresolved: boolean;
  displayTotal: number;
  itemCount: number;
  contactCount: number;
  paidCount: number;
  progress: number;
  iconColors: { primary: string; muted: string; pro: string };
  hasUnassignedItems: boolean;
  mode: ColorMode;
}) {
  const glow = useMemo(
    () => buildGlowTheme(stateStyle.color, mode, stateStyle.intensity),
    [stateStyle.color, mode, stateStyle.intensity],
  );

  const [cardHeight, setCardHeight] = useState(120);
  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    setCardHeight(e.nativeEvent.layout.height);
  }, []);

  const { shouldUseGlass: glassEnabled } = useGlassEffect();
  const shouldUseGlass = glassEnabled && !isDraft;
  const accentColor = hasUnassignedItems ? '#f59e0b' : stateStyle.color;

  return (
    <Pressable onPress={onPress} style={{ opacity: locked ? 0.5 : 1 }}>
      <View style={{ marginBottom: 10 }}>
        {shouldUseGlass ? (
          <GlassView
            onLayout={onCardLayout}
            glassEffectStyle="regular"
            tintColor={accentColor + '0D'}
            style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, overflow: 'hidden' }}
          >
            <CornerGlow size={cardHeight - 20} color={accentColor} corner="top-left" cardBg="transparent" />
            <CornerGlow size={cardHeight - 20} color={accentColor} corner="bottom-right" cardBg="transparent" />
            <CardContent
              bill={bill} stateStyle={stateStyle} label={label} isDraft={isDraft} isUnresolved={isUnresolved}
              displayTotal={displayTotal} itemCount={itemCount} contactCount={contactCount} paidCount={paidCount}
              iconColors={iconColors} t={t} locked={locked} isIOS shouldUseGlass
            />
          </GlassView>
        ) : (
          <View
            onLayout={onCardLayout}
            className={cn('overflow-hidden rounded-[20px] bg-card px-4 py-3', isDraft && 'opacity-60')}
            style={{ zIndex: 1, borderWidth: isDraft ? 0 : 1, borderColor: isDraft ? 'transparent' : hasUnassignedItems ? '#f59e0b33' : glow.glowMid }}
          >
            {!isDraft && (
              <>
                <CornerGlow size={cardHeight - 20} color={accentColor} corner="top-left" cardBg={glow.cardBg} />
                <CornerGlow size={cardHeight - 20} color={accentColor} corner="bottom-right" cardBg={glow.cardBg} />
              </>
            )}
            <CardContent
              bill={bill} stateStyle={stateStyle} label={label} isDraft={isDraft} isUnresolved={isUnresolved}
              displayTotal={displayTotal} itemCount={itemCount} contactCount={contactCount} paidCount={paidCount}
              iconColors={iconColors} t={t} locked={locked} isIOS
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function BillCardAndroid({
  bill,
  onPress,
  t,
  locked = false,
  stateStyle,
  label,
  isDraft,
  isUnresolved,
  displayTotal,
  itemCount,
  contactCount,
  paidCount,
  iconColors,
  hasUnassignedItems,
}: BillCardProps & {
  stateStyle: (typeof STATE_STYLES)[BillState];
  label: string;
  isDraft: boolean;
  isUnresolved: boolean;
  displayTotal: number;
  itemCount: number;
  contactCount: number;
  paidCount: number;
  iconColors: { primary: string; muted: string; pro: string };
  hasUnassignedItems: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-xl border-l-[3px] bg-card px-4 py-3 active:opacity-80',
        hasUnassignedItems ? 'border-l-amber-500' : stateStyle.borderClass,
        isDraft && 'opacity-60',
        isUnresolved && 'bg-amber-500/[0.03]',
        locked && 'opacity-50',
      )}
    >
      <CardContent
        bill={bill} stateStyle={stateStyle} label={label} isDraft={isDraft} isUnresolved={isUnresolved}
        displayTotal={displayTotal} itemCount={itemCount} contactCount={contactCount} paidCount={paidCount}
        iconColors={iconColors} t={t} locked={locked} isIOS={false}
      />
    </Pressable>
  );
}

function computeDisplayTotal(bill: Bill): number {
  const billCountry = (bill.country as 'CO' | 'US') || 'CO';
  const billCategory = (bill.tags?.find((tag) => tag.isPlatform)?.slug as 'dining' | 'retail' | 'service') || 'dining';
  const rawTaxConfig = getTaxConfig(billCountry, billCategory);
  const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill.taxIncludedOverride ?? undefined);
  const itemsTotal = bill.items.reduce((subtotalSum, item) => subtotalSum + item.subtotal, 0);
  const base = computeBase(itemsTotal, taxConfig);
  const computedTax = computeTax(itemsTotal, taxConfig);
  const tipPercent = bill.tipPercent ?? 0;
  const computedTip = bill.useCustomTip ? (bill.tip ?? 0) : base * (tipPercent / 100);
  return base + computedTax + computedTip;
}

function BillCard({ bill, onPress, t, locked = false }: BillCardProps) {
  const colorScheme = useColorScheme();
  const mode: ColorMode = colorScheme === 'dark' ? 'dark' : 'light';
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const stateStyle = STATE_STYLES[bill.state as BillState];
  const label = stateLabel(t, bill.state as BillState);

  const isDraft = bill.state === 'draft';
  const isUnresolved = bill.state === 'unresolved';

  const itemCount = bill.totalItemCount ?? bill.items.length;
  const contactCount = bill.totalContactCount ?? bill.contacts.length;
  const paidCount = bill.paidContactCount ?? bill.contacts.filter((contact) => contact.paid).length;
  const assignedItems = bill.assignedItemCount ??
    (bill.state !== 'unsplit' && bill.state !== 'draft'
      ? new Set(bill.contacts.flatMap((contact) => contact.items.map((item) => item.itemId))).size
      : 0);
  const progress = bill.progress ?? (itemCount > 0 ? assignedItems / itemCount : 0);
  const hasUnassignedItems = contactCount > 0 && progress < 1 && !isDraft;
  const displayTotal = bill.displayTotal ?? computeDisplayTotal(bill);

  const shared = {
    bill, onPress, t, locked, stateStyle, label, isDraft, isUnresolved,
    displayTotal, itemCount, contactCount, paidCount, progress, iconColors, hasUnassignedItems,
  };

  if (Platform.OS === 'ios') return <BillCardIOS {...shared} mode={mode} />;
  return <BillCardAndroid {...shared} />;
}

export default React.memo(BillCard, (prev, next) =>
  prev.bill.state === next.bill.state &&
  prev.bill.name === next.bill.name &&
  prev.bill.total === next.bill.total &&
  prev.bill.displayTotal === next.bill.displayTotal &&
  prev.bill.paidContactCount === next.bill.paidContactCount &&
  prev.bill.totalContactCount === next.bill.totalContactCount &&
  prev.bill.assignedItemCount === next.bill.assignedItemCount &&
  prev.bill.progress === next.bill.progress &&
  prev.bill.contacts.length === next.bill.contacts.length &&
  prev.locked === next.locked,
);
