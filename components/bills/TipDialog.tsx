import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Switch, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import CurrencyInput from '@/components/form/CurrencyInput';
import { useT } from '@/lib/i18n';

interface TipDialogProps {
  visible: boolean;
  tipPercent: number;
  useCustomTip: boolean;
  customTip: number;
  subtotal: number;
  billCountry: 'CO' | 'US';
  iconColors: Record<string, string>;
  onSelectTip: (percent: number, tipAmount: number) => void;
  onSelectCustomTip: (tipAmount: number) => void;
  onToggleCustomTip: (enabled: boolean) => void;
  onClose: () => void;
}

function TipDialog({
  visible,
  tipPercent,
  useCustomTip,
  customTip,
  subtotal,
  billCountry,
  iconColors,
  onSelectTip,
  onSelectCustomTip,
  onToggleCustomTip,
  onClose,
}: TipDialogProps) {
  const t = useT();
  const [localCustomTip, setLocalCustomTip] = useState(customTip);

  // Sync local state when dialog opens or customTip changes
  useEffect(() => {
    if (visible) setLocalCustomTip(customTip);
  }, [visible, customTip]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback>
            <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
              <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.tipDialog_title}</Text>

              {/* Percentage chips */}
              <View className="flex-row flex-wrap gap-2">
                {[0, 5, 10, 15, 18, 20].map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => {
                      const newTip = Math.round(subtotal * (pct / 100));
                      onSelectTip(pct, newTip);
                    }}
                    className={cn(
                      'min-w-[70px] flex-1 items-center rounded-xl border-[1.5px] py-3',
                      !useCustomTip && tipPercent === pct
                        ? 'border-primary/35 bg-primary/15'
                        : 'border-muted-foreground/12 bg-muted-foreground/[0.06]',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[15px] font-bold',
                        !useCustomTip && tipPercent === pct ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {pct}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Divider */}
              <View className="my-4 h-px bg-border/30" />

              {/* Custom tip toggle */}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">{t.bill_customTip}</Text>
                <Switch
                  value={useCustomTip}
                  onValueChange={(v) => onToggleCustomTip(v)}
                  trackColor={{ true: iconColors.primary }}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>

              {/* Custom tip input */}
              {useCustomTip && (
                <View className="mt-3">
                  <CurrencyInput
                    value={localCustomTip}
                    onChangeValue={(n) => setLocalCustomTip(n ?? 0)}
                    country={billCountry}
                    className="h-11 rounded-xl border border-border bg-muted px-3 text-center text-base font-semibold tabular-nums shadow-none"
                  />
                  <Pressable
                    onPress={() => {
                      onSelectCustomTip(localCustomTip);
                      onClose();
                    }}
                    className="mt-3 items-center rounded-xl bg-primary py-3"
                  >
                    <Text className="text-sm font-semibold text-primary-foreground">{t.confirm}</Text>
                  </Pressable>
                </View>
              )}

              {/* Cancel */}
              {!useCustomTip && (
                <Pressable
                  onPress={onClose}
                  className="mt-4 items-center rounded-xl bg-muted py-3"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
                </Pressable>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default React.memo(TipDialog);
