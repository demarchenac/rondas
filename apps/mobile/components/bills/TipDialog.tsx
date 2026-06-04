import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import CurrencyInput from '@/components/form/CurrencyInput';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';

interface TipDialogProps {
  visible: boolean;
  tipPercent: number;
  shouldUseCustomTip: boolean;
  customTip: number;
  subtotal: number;
  billCountry: 'CO' | 'US';
  decimalPlaces?: number;
  iconColors: Record<string, string>;
  onSelectTip: (percent: number, tipAmount: number) => void;
  onSelectCustomTip: (tipAmount: number) => void;
  onToggleCustomTip: (enabled: boolean) => void;
  onClose: () => void;
}

function TipDialog({
  visible,
  tipPercent,
  shouldUseCustomTip,
  customTip,
  subtotal,
  billCountry,
  decimalPlaces,
  iconColors,
  onSelectTip,
  onSelectCustomTip,
  onToggleCustomTip,
  onClose,
}: TipDialogProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<TrueSheet>(null);
  const [localCustomTip, setLocalCustomTip] = useState(customTip);
  const [wasPrevVisible, setPrevVisible] = useState(false);
  if (visible !== wasPrevVisible) {
    setPrevVisible(visible);
    if (visible) setLocalCustomTip(customTip);
  }

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  return (
    <TrueSheet
      ref={sheetRef}
      name="tip-dialog"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}>
        <Text className="px-6 pt-4 pb-4 text-2xl font-bold text-foreground">{t.tipDialog_title}</Text>

        {/* Percentage chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24 }}>
          {[0, 5, 10, 15, 18, 20].map((pct) => (
            <Pressable
              key={pct}
              onPress={() => {
                const newTip = Math.round(subtotal * (pct / 100));
                onSelectTip(pct, newTip);
              }}
              style={{ flexBasis: '31%', flexGrow: 1 }}
              className={cn(
                'items-center rounded-xl border-[1.5px] py-3',
                !shouldUseCustomTip && tipPercent === pct
                  ? 'border-primary/35 bg-primary/15'
                  : 'border-muted-foreground/12 bg-muted-foreground/[0.06]',
              )}
            >
              <Text className={cn('text-lg font-bold', !shouldUseCustomTip && tipPercent === pct ? 'text-primary' : 'text-muted-foreground')}>
                {pct}%
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="mx-6 my-4 h-px bg-border/30" />

        {/* Custom tip toggle */}
        <View className="flex-row items-center justify-between px-6">
          <Text className="text-base font-medium text-foreground">{t.bill_customTip}</Text>
          <Switch
            value={shouldUseCustomTip}
            onValueChange={(v) => onToggleCustomTip(v)}
            trackColor={{ true: iconColors.primary }}
            style={{ transform: [{ scale: 0.8 }] }}
          />
        </View>

        {shouldUseCustomTip && (
          <View className="px-6 mt-3">
            <CurrencyInput
              value={localCustomTip}
              onChangeValue={(n) => setLocalCustomTip(n ?? 0)}
              country={billCountry}
              decimalPlaces={decimalPlaces}
              className="h-11 rounded-xl border border-border bg-muted px-3 text-center text-lg font-semibold tabular-nums"
            />
            <Pressable
              onPress={() => { onSelectCustomTip(localCustomTip); onClose(); }}
              className="mt-3 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-base font-semibold text-primary-foreground">{t.confirm}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </TrueSheet>
  );
}

export default React.memo(TipDialog);
