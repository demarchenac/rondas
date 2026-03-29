import React from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { ICON_COLORS } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/format';

interface TipDialogProps {
  visible: boolean;
  tipPercent: number;
  subtotal: number;
  billCountry: 'CO' | 'US';
  onSelectTip: (percent: number, tipAmount: number) => void;
  onClose: () => void;
}

function TipDialog({ visible, tipPercent, subtotal, billCountry, onSelectTip, onClose }: TipDialogProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback>
            <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
              <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.tipDialog_title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[0, 5, 10, 15, 18, 20].map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => {
                      const newTip = Math.round(subtotal * (pct / 100));
                      onSelectTip(pct, newTip);
                    }}
                    className={`min-w-[70px] flex-1 items-center rounded-xl border-[1.5px] py-3 ${
                      tipPercent === pct
                        ? 'border-primary/35 bg-primary/15'
                        : 'border-muted-foreground/12 bg-muted-foreground/[0.06]'
                    }`}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: tipPercent === pct ? iconColors.primary : iconColors.muted,
                      }}
                    >
                      {pct}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={onClose}
                className="mt-4 items-center rounded-xl bg-muted py-3"
              >
                <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default TipDialog;
