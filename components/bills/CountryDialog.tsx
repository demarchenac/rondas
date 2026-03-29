import React from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
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
        <View className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback>
            <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
              <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.countryDialog_title}</Text>
              <View className="gap-2">
                {([
                  { code: 'CO' as const, flag: '\u{1F1E8}\u{1F1F4}', label: t.settings_countryColombia },
                  { code: 'US' as const, flag: '\u{1F1FA}\u{1F1F8}', label: t.settings_countryUSA },
                ]).map((option) => (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      onSelectCountry(option.code);
                    }}
                    className={cn(
                      'flex-row items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-3.5',
                      billCountry === option.code
                        ? 'border-primary/35 bg-primary/15'
                        : 'border-muted-foreground/12 bg-muted-foreground/[0.06]',
                    )}
                  >
                    <Text className="text-xl">{option.flag}</Text>
                    <Text
                      className={cn(
                        'text-[15px] font-semibold',
                        billCountry === option.code ? 'text-primary' : 'text-muted-foreground',
                      )}
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
