import React from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useT } from '@/lib/i18n';

interface CountryDialogProps {
  visible: boolean;
  billCountry: 'CO' | 'US';
  onSelectCountry: (country: 'CO' | 'US') => void;
  onClose: () => void;
}

function CountryDialog({ visible, billCountry, onSelectCountry, onClose }: CountryDialogProps) {
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
              <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.countryDialog_title}</Text>
              <View style={{ gap: 8 }}>
                {([
                  { code: 'CO' as const, flag: '\u{1F1E8}\u{1F1F4}', label: t.settings_countryColombia },
                  { code: 'US' as const, flag: '\u{1F1FA}\u{1F1F8}', label: t.settings_countryUSA },
                ]).map((option) => (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      onSelectCountry(option.code);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: billCountry === option.code ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
                      borderWidth: 1.5,
                      borderColor: billCountry === option.code ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{option.flag}</Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: billCountry === option.code ? '#38bdf8' : '#64748b',
                      }}
                    >
                      {option.label}
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

export default CountryDialog;
