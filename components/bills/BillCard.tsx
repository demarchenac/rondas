import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ResolvedBill } from '@/lib/filters';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Avatar from '@/components/ui/avatar';
import AnimatedBadge from '@/components/bills/AnimatedBadge';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { relativeTime } from '@/lib/date';
import { STATE_STYLES, stateLabel, type BillState } from '@/lib/billHelpers';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride } from '@/constants/taxes';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { buildGlowTheme, type ColorMode } from '@/lib/stateTheme';
import type { Translations } from '@/lib/i18n';

type Bill = ResolvedBill;

export interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  t: Translations;
  locked?: boolean;
}

const CATEGORY_ICONS: Record<string, 'fork.knife' | 'cart' | 'wrench.adjustable'> = {
  dining: 'fork.knife',
  retail: 'cart',
  service: 'wrench.adjustable',
};

// --- Pulsing dot for unresolved badge ---

function PulsingDot({ color, pulse }: { color: string; pulse: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    scale.value = withRepeat(
      withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 3,
        },
        pulse && animatedStyle,
      ]}
    />
  );
}

// --- SVG corner artifacts with bezier curves ---

function CornerGlow({
  size,
  color,
  corner,
  cardBg,
}: {
  size: number;
  color: string;
  corner: 'top-left' | 'bottom-right';
  cardBg: string;
}) {
  const gradId = corner === 'top-left' ? 'tlGrad' : 'brGrad';
  const cp = size * 0.08;

  const path =
    corner === 'top-left'
      ? `M 0 0 L ${size} 0 Q ${cp} ${cp} 0 ${size} Z`
      : `M ${size} ${size} L 0 ${size} Q ${size - cp} ${size - cp} ${size} 0 Z`;

  // Gradient goes from corner vertex straight toward the bezier midpoint
  const gradProps =
    corner === 'top-left'
      ? { x1: '0', y1: '0', x2: `${size * 0.5}`, y2: `${size * 0.5}` }
      : { x1: `${size}`, y1: `${size}`, x2: `${size * 0.5}`, y2: `${size * 0.5}` };

  return (
    <Svg width={size} height={size} style={{
      position: 'absolute',
      ...(corner === 'top-left' ? { top: 0, left: 0 } : { bottom: 0, right: 0 }),
    }}>
      <Defs>
        <SvgGradient id={gradId} gradientUnits="userSpaceOnUse" {...gradProps}>
          <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <Stop offset="20%" stopColor={color} stopOpacity={0.2} />
          <Stop offset="45%" stopColor={color} stopOpacity={0.06} />
          <Stop offset="65%" stopColor={color} stopOpacity={0} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={path} fill={`url(#${gradId})`} />
    </Svg>
  );
}

// --- Shared content rows (used by both platforms) ---

function GlassBadge({ stateStyle, label }: { stateStyle: (typeof STATE_STYLES)[BillState]; label: string }) {
  const isDashed = stateStyle.intensity === 'low';
  const hasDot = stateStyle.intensity === 'normal' || stateStyle.intensity === 'high';
  const isUnsplit = stateStyle.color === '#94a3b8';

  return (
    <View
      style={{
        paddingHorizontal: hasDot && !isUnsplit ? 8 : 10,
        paddingVertical: 3,
        borderRadius: 100,
        backgroundColor: stateStyle.bg,
        borderWidth: 1,
        borderColor: stateStyle.color + '30',
        borderStyle: isDashed ? 'dashed' : 'solid',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {hasDot && !isUnsplit && (
        <PulsingDot color={stateStyle.color} pulse={stateStyle.pulse} />
      )}
      <Text
        style={{
          fontSize: 11,
          fontWeight: stateStyle.pulse ? '600' : '500',
          color: stateStyle.color,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function CardContent({
  bill,
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
  t,
  locked,
  isIOS,
}: {
  bill: Bill;
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
  t: Translations;
  locked: boolean;
  isIOS: boolean;
}) {
  const categoryIcon = bill.category ? CATEGORY_ICONS[bill.category] : null;
  const billCountry = (bill.country as 'CO' | 'US') || 'CO';

  return (
    <>
      {locked && (
        <View className="absolute right-3 top-3 z-10 h-7 w-7 items-center justify-center rounded-full bg-pro/15">
          <IconSymbol name="lock.fill" size={14} color={iconColors.pro} />
        </View>
      )}

      {/* Top row: category icon + name + badge */}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          {categoryIcon && (
            <IconSymbol name={categoryIcon} size={14} color={iconColors.muted} />
          )}
          <Text className={cn('flex-1 font-bold text-sm', isDraft ? 'text-muted-foreground' : 'text-foreground')} numberOfLines={1}>
            {bill.name}
          </Text>
          {isUnresolved && (
            <IconSymbol name="exclamationmark.triangle" size={13} color={stateStyle.color} />
          )}
        </View>
        {isIOS ? (
          <GlassBadge stateStyle={stateStyle} label={label} />
        ) : (
          <AnimatedBadge variant={bill.state as BillState} label={label} />
        )}
      </View>

      {/* Amount */}
      <Text
        className={cn('mt-1 text-2xl font-extrabold tracking-tight', isDraft ? 'text-muted-foreground' : 'text-foreground')}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatCurrency(displayTotal, billCountry, bill.decimalPlaces)}
      </Text>

      {/* Meta row: time + items + contacts */}
      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {relativeTime(bill._creationTime, t)} · {t.billCard_items(itemCount)}
        </Text>

        {contactCount > 0 && (
          <View className="flex-row items-center gap-2">
            {isUnresolved && (
              <Text className="text-[10px] font-semibold text-amber-500">
                {paidCount}/{contactCount}
              </Text>
            )}
            <View className="flex-row items-center">
              {bill.contacts.slice(0, 3).map((c, i) => (
                <Avatar
                  key={c.contactId}
                  name={c.name}
                  imageUri={c.imageUri}
                  size="xs"
                  className={cn('border-2 border-card', i > 0 && '-ml-2')}
                  bgClassName={stateStyle.bgClass}
                  textClassName={stateStyle.textClass}
                />
              ))}
              {contactCount > 3 && (
                <View className="-ml-2 h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-card bg-muted-foreground/15">
                  <Text className="text-[9px] font-bold text-muted-foreground">
                    +{contactCount - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Progress bar for unresolved bills */}
      {isUnresolved && itemCount > 0 && (
        <View className="mt-2">
          <View className="h-[3px] overflow-hidden rounded-sm bg-muted-foreground/15">
            <View
              className={cn('h-full rounded-sm', stateStyle.progressClass)}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
        </View>
      )}
    </>
  );
}

// --- iOS Liquid Glass card ---

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
  mode: ColorMode;
}) {
  const glow = useMemo(
    () => buildGlowTheme(stateStyle.color, mode, stateStyle.intensity),
    [stateStyle.color, mode, stateStyle.intensity],
  );

  const glassAvailable = useMemo(() => isGlassEffectAPIAvailable(), []);

  const [cardHeight, setCardHeight] = useState(120);
  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    setCardHeight(e.nativeEvent.layout.height);
  }, []);

  // GlassView disabled for now — dark backgrounds don't benefit from glass blur.
  // Re-enable for light mode or overlay use cases.
  const useGlass = false && glassAvailable && !isDraft;
  const glassColorScheme = mode === 'dark' ? 'dark' : 'light';
  const glassTint = stateStyle.color + '10';

  return (
    <Pressable onPress={onPress} style={{ opacity: locked ? 0.5 : 1 }}>
      <View style={{ marginBottom: 10 }}>
        {/* Layer 1: Gradient background — behind card, extends below */}
        {!isDraft && (
          <LinearGradient
            colors={[stateStyle.color + '60', stateStyle.color + '25', 'transparent']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: cardHeight + 20,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
            pointerEvents="none"
          />
        )}

        {/* Layer 2: Card — GlassView when available, View fallback */}
        {useGlass ? (
        <GlassView
          glassEffectStyle="clear"
          colorScheme={glassColorScheme}
          onLayout={onCardLayout}
          className="overflow-hidden rounded-[20px] px-4 py-3"
          style={{
            zIndex: 1,
            shadowColor: stateStyle.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isUnresolved ? 0.28 : 0.14,
            shadowRadius: isUnresolved ? 12 : 8,
            borderWidth: 1,
            borderColor: glow.glowMid,
          }}
        >
          {/* Layer 3: Corner bezier artifacts */}
          <>
            <CornerGlow size={cardHeight - 20} color={stateStyle.color} corner="top-left" cardBg={glow.cardBg} />
            <CornerGlow size={cardHeight - 20} color={stateStyle.color} corner="bottom-right" cardBg={glow.cardBg} />
          </>
          {/* Layer 4: Content */}
          <View style={{ zIndex: 2 }}>
            <CardContent
              bill={bill}
              stateStyle={stateStyle}
              label={label}
              isDraft={isDraft}
              isUnresolved={isUnresolved}
              displayTotal={displayTotal}
              itemCount={itemCount}
              contactCount={contactCount}
              paidCount={paidCount}
              progress={progress}
              iconColors={iconColors}
              t={t}
              locked={locked}
              isIOS
            />
          </View>
        </GlassView>
        ) : (
        <View
          onLayout={onCardLayout}
          className={cn(
            'overflow-hidden rounded-[20px] bg-card px-4 py-3',
            isDraft && 'opacity-60',
          )}
          style={{
            zIndex: 1,
            shadowColor: stateStyle.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDraft ? 0 : isUnresolved ? 0.28 : 0.14,
            shadowRadius: isUnresolved ? 12 : 8,
            borderWidth: isDraft ? 0 : 1,
            borderColor: isDraft ? 'transparent' : glow.glowMid,
          }}
        >
          {/* Corner bezier artifacts for fallback */}
          {!isDraft && (
            <>
              <CornerGlow size={cardHeight - 20} color={stateStyle.color} corner="top-left" cardBg={glow.cardBg} />
              <CornerGlow size={cardHeight - 20} color={stateStyle.color} corner="bottom-right" cardBg={glow.cardBg} />
            </>
          )}
          <View style={{ zIndex: 2 }}>
            <CardContent
              bill={bill}
              stateStyle={stateStyle}
              label={label}
              isDraft={isDraft}
              isUnresolved={isUnresolved}
              displayTotal={displayTotal}
              itemCount={itemCount}
              contactCount={contactCount}
              paidCount={paidCount}
              progress={progress}
              iconColors={iconColors}
              t={t}
              locked={locked}
              isIOS
            />
          </View>
        </View>
        )}
      </View>
    </Pressable>
  );
}

// --- Android card (simple, current style) ---

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
  progress,
  iconColors,
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
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-xl border-l-[3px] bg-card px-4 py-3 active:opacity-80',
        stateStyle.borderClass,
        isDraft && 'opacity-60',
        isUnresolved && 'bg-amber-500/[0.03]',
        locked && 'opacity-50',
      )}
    >
      <CardContent
        bill={bill}
        stateStyle={stateStyle}
        label={label}
        isDraft={isDraft}
        isUnresolved={isUnresolved}
        displayTotal={displayTotal}
        itemCount={itemCount}
        contactCount={contactCount}
        paidCount={paidCount}
        progress={progress}
        iconColors={iconColors}
        t={t}
        locked={locked}
        isIOS={false}
      />
    </Pressable>
  );
}

// --- Main component ---

function BillCard({ bill, onPress, t, locked = false }: BillCardProps) {
  const { colorScheme } = useColorScheme();
  const mode: ColorMode = colorScheme === 'dark' ? 'dark' : 'light';
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const stateStyle = STATE_STYLES[bill.state as BillState];
  const label = stateLabel(t, bill.state as BillState);

  const isDraft = bill.state === 'draft';
  const isUnresolved = bill.state === 'unresolved';

  // Use denormalized fields from Convex when available, fallback to client computation
  const itemCount = bill.totalItemCount ?? bill.items.length;
  const contactCount = bill.totalContactCount ?? bill.contacts.length;
  const paidCount = bill.paidContactCount ?? bill.contacts.filter((c) => c.paid).length;
  const assignedItems = bill.assignedItemCount ??
    (bill.state !== 'unsplit' && bill.state !== 'draft'
      ? new Set(bill.contacts.flatMap((c) => c.items.map((i) => i.itemId))).size
      : 0);
  const progress = bill.progress ?? (itemCount > 0 ? assignedItems / itemCount : 0);

  // displayTotal: prefer denormalized, fallback to client tax computation
  let displayTotal: number;
  if (bill.displayTotal != null) {
    displayTotal = bill.displayTotal;
  } else {
    const billCountry = (bill.country as 'CO' | 'US') || 'CO';
    const billCategory = (bill.category as 'dining' | 'retail' | 'service') || 'dining';
    const rawTaxConfig = getTaxConfig(billCountry, billCategory);
    const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill.taxIncludedOverride ?? undefined);
    const itemsTotal = bill.items.reduce((sum, i) => sum + i.subtotal, 0);
    const base = computeBase(itemsTotal, taxConfig);
    const computedTax = computeTax(itemsTotal, taxConfig);
    const tipPercent = bill.tipPercent ?? 0;
    const computedTip = bill.useCustomTip ? (bill.tip ?? 0) : base * (tipPercent / 100);
    displayTotal = base + computedTax + computedTip;
  }

  const shared = {
    bill,
    onPress,
    t,
    locked,
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
  };

  if (Platform.OS === 'ios') {
    return <BillCardIOS {...shared} mode={mode} />;
  }
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
