import React from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/text';
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
                    style={{
                      flex: 1,
                      minWidth: 70,
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: tipPercent === pct ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
                      borderWidth: 1.5,
                      borderColor: tipPercent === pct ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: tipPercent === pct ? '#38bdf8' : '#64748b',
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
