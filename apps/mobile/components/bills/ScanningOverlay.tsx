import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { formatCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';

// --- Types ---

interface ScanItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface KeyedScanItem extends ScanItem {
  _key: string;
}

interface ScanProgressData {
  status?: string;
  result?: {
    items?: ScanItem[];
    decimalPlaces?: number;
  } | null;
}

type ScanPhase = 'uploading' | 'analyzing' | 'thinking' | 'extracting' | 'complete';

interface ScanningOverlayProps {
  scanProgress: ScanProgressData | null | undefined;
  localPhase: ScanPhase;
  billCountry: string;
  decimalPlaces?: number;
}

// --- Confidence heuristic ---

function computeConfidence(item: ScanItem): number {
  if (item.subtotal === 0) return 1; // modifiers exempt
  let score = 0;
  if (item.name.trim().length > 0) score += 0.25;
  if (item.name.length >= 3 && item.name.length <= 80) score += 0.15;
  if (item.quantity > 0) score += 0.20;
  if (item.subtotal > 0) score += 0.15;
  if (item.subtotal === item.quantity * item.unitPrice) score += 0.25;
  return score;
}

function getConfidenceBorderColor(confidence: number): string | undefined {
  if (confidence < 0.60) return '#ef4444'; // red
  if (confidence < 0.85) return '#f59e0b'; // amber
  return undefined;
}

// --- Status label ---

function getPhaseLabel(
  phase: ScanPhase,
  t: ReturnType<typeof useT>,
  pricedCount: number,
): string {
  switch (phase) {
    case 'uploading':
      return t.scan_uploading;
    case 'analyzing':
    case 'thinking':
      return t.scan_detecting;
    case 'extracting':
      return t.scan_itemsFound(pricedCount);
    case 'complete':
      return t.scan_complete(pricedCount);
  }
}

// Phase group — determines when to animate the label transition vs instant update
function getPhaseGroup(phase: ScanPhase, hasPricedItems: boolean): string {
  if (phase === 'uploading') return 'uploading';
  if (phase === 'analyzing' || phase === 'thinking') return 'detecting';
  if (phase === 'extracting' && !hasPricedItems) return 'extracting-waiting';
  if (phase === 'extracting') return 'extracting-counting';
  if (phase === 'complete') return 'complete';
  return phase;
}

// --- Stagger queue hook (Bug 2 fix) ---

function useStaggeredItems(
  sourceItems: ScanItem[],
  isComplete: boolean,
  staggerMs = 150,
): KeyedScanItem[] {
  const [displayed, setDisplayed] = useState<KeyedScanItem[]>([]);
  const queueRef = useRef<KeyedScanItem[]>([]);
  const processingRef = useRef(false);
  const processedCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processQueueRef = useRef<(() => void) | null>(null);
  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    if (queueRef.current.length === 0) return;

    processingRef.current = true;
    const next = queueRef.current.shift()!;

    setDisplayed((prev) => [next, ...prev]);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (computeConfidence(next) < 0.60) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    timerRef.current = setTimeout(() => {
      processingRef.current = false;
      processQueueRef.current?.();
    }, staggerMs);
  }, [staggerMs]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Enqueue new items as they arrive from Convex
  useEffect(() => {
    const alreadyCount = processedCountRef.current + queueRef.current.length;
    if (sourceItems.length > alreadyCount) {
      const newItems = sourceItems.slice(alreadyCount).map((item, i) => ({
        ...item,
        _key: `item-${alreadyCount + i}`,
      }));
      processedCountRef.current += newItems.length;
      queueRef.current.push(...newItems);
      processQueue();
    }
  }, [sourceItems, processQueue]);

  // Flush remaining queue on complete
  useEffect(() => {
    if (!isComplete) return;
    if (queueRef.current.length === 0) return;

    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    processingRef.current = false;

    // Flush all remaining items at once
    const remaining = queueRef.current.splice(0);
    const keyed = remaining.reverse(); // newest first for unshift display
    setDisplayed((prev) => [...keyed, ...prev]);
    queueRef.current = [];
  }, [isComplete]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return displayed;
}

// --- Animated running total ---

function RunningTotal({
  total,
  pricedCount,
  billCountry,
  decimalPlaces,
}: {
  total: number;
  pricedCount: number;
  billCountry: string;
  decimalPlaces?: number;
}) {
  const t = useT();
  const scale = useSharedValue(1);
  const prevTotal = useRef(total);

  useEffect(() => {
    if (total !== prevTotal.current) {
      prevTotal.current = total;
      scale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
    }
  }, [total, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (pricedCount === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="border-t border-white/[0.08] px-4 pt-3 pb-1"
    >
      <Animated.View style={animatedStyle} className="items-center">
        <Text className="text-[22px] font-bold tabular-nums text-primary">
          {formatCurrency(total, billCountry, decimalPlaces)}
        </Text>
      </Animated.View>
      <Text className="mt-1 text-center text-sm text-muted-foreground">
        {t.scan_itemsFound(pricedCount)}
      </Text>
    </Animated.View>
  );
}

// --- Streaming item row ---

const StreamItem = React.memo(function StreamItem({
  item,
  isModifier,
  billCountry,
  decimalPlaces,
}: {
  item: KeyedScanItem;
  isModifier: boolean;
  billCountry: string;
  decimalPlaces?: number;
}) {
  const confidence = computeConfidence(item);
  const borderColor = getConfidenceBorderColor(confidence);

  const displayName =
    item.quantity > 1 && !isModifier
      ? `${item.quantity}× ${item.name}`
      : item.name;

  return (
    <Animated.View
      entering={FadeIn.duration(250).delay(50)}
      layout={LinearTransition.duration(300)}
      style={borderColor ? { borderLeftWidth: 3, borderLeftColor: borderColor } : undefined}
      className="flex-row justify-between py-1.5 pl-3 pr-0"
    >
      <Text
        className={`flex-1 text-sm ${isModifier ? 'italic text-muted-foreground' : 'text-foreground'}`}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {!isModifier && (
        <Text className={`ml-3 text-sm font-semibold ${item.subtotal < 0 ? 'text-emerald-500' : 'text-primary'}`}>
          {formatCurrency(item.subtotal, billCountry, decimalPlaces)}
        </Text>
      )}
    </Animated.View>
  );
});

// --- Main overlay ---

function ScanningOverlay({
  scanProgress,
  localPhase,
  billCountry,
  decimalPlaces,
}: ScanningOverlayProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [prevPhaseGroup, setPrevPhaseGroup] = useState('');

  // Determine effective phase
  const effectivePhase: ScanPhase = localPhase === 'uploading'
    ? 'uploading'
    : (scanProgress?.status as ScanPhase) ?? 'analyzing';

  const isComplete = effectivePhase === 'complete';

  // Source items from Convex (original extraction order)
  const sourceItems = useMemo(
    () => scanProgress?.result?.items ?? [],
    [scanProgress?.result?.items],
  );

  // Stagger queue: drips items one at a time, flushes on complete
  const displayedItems = useStaggeredItems(sourceItems, isComplete);

  const pricedCount = useMemo(
    () => displayedItems.filter((i) => i.subtotal > 0).length,
    [displayedItems],
  );

  const runningTotal = useMemo(
    () => displayedItems.reduce((sum, i) => sum + i.subtotal, 0),
    [displayedItems],
  );

  // Phase group for conditional animation (Bug 3 fix)
  const hasPricedItems = pricedCount > 0;
  const phaseGroup = getPhaseGroup(effectivePhase, hasPricedItems);

  const statusLabel = getPhaseLabel(
    effectivePhase === 'extracting' && pricedCount > 0
      ? 'extracting'
      : effectivePhase,
    t,
    pricedCount,
  );

  const isPhaseTransition = prevPhaseGroup !== '' && prevPhaseGroup !== phaseGroup;
  if (phaseGroup !== prevPhaseGroup) {
    setPrevPhaseGroup(phaseGroup);
  }

  // Haptic on phase transitions only
  useEffect(() => {
    if (isPhaseTransition) {
      Haptics.selectionAsync();
    }
  }, [isPhaseTransition]);

  return (
    <View className="absolute bottom-0 left-0 right-0 top-0 items-center">
      <BlurView
        intensity={30}
        tint="dark"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(18,26,46,0.7)',
        }}
      />
      <View
        className="z-[1] w-full flex-1 items-center px-8"
        style={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 16 }}
      >
        {/* Spinner / Checkmark */}
        <View className="h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          {isComplete ? (
            <Animated.View entering={FadeIn.duration(200).springify()}>
              <Animated.View
                entering={FadeIn.duration(100)}
                style={{ transform: [{ scale: 1 }] }}
              >
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={40}
                  color={iconColors.success}
                />
              </Animated.View>
            </Animated.View>
          ) : (
            <ActivityIndicator size="large" color={iconColors.primary} />
          )}
        </View>

        {/* Status label — animate phase transitions, instant counter updates */}
        {isPhaseTransition ? (
          <Animated.View
            key={phaseGroup}
            entering={FadeInUp.duration(200)}
            exiting={FadeOutUp.duration(200)}
            className="mt-5"
          >
            <Text className="text-center text-xl font-bold text-foreground">
              {statusLabel}
            </Text>
          </Animated.View>
        ) : (
          <View className="mt-5">
            <Text className="text-center text-xl font-bold text-foreground">
              {statusLabel}
            </Text>
          </View>
        )}

        {/* Scrollable item list — newest on top via stagger queue */}
        {displayedItems.length > 0 && (
          <View className="mt-4 w-full" style={{ flex: 1, minHeight: 60 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {displayedItems.map((item) => (
                <StreamItem
                  key={item._key}
                  item={item}
                  isModifier={item.subtotal === 0}
                  billCountry={billCountry}
                  decimalPlaces={decimalPlaces ?? scanProgress?.result?.decimalPlaces}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Anchored running total */}
        <RunningTotal
          total={runningTotal}
          pricedCount={pricedCount}
          billCountry={billCountry}
          decimalPlaces={decimalPlaces ?? scanProgress?.result?.decimalPlaces}
        />
      </View>
    </View>
  );
}

export default React.memo(ScanningOverlay);
