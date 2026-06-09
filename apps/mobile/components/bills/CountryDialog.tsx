import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View , useColorScheme } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  return (
    <TrueSheet
      ref={sheetRef}
      name="country-dialog"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}>
        <Text className="px-6 pt-4 pb-4 text-2xl font-bold text-foreground">{t.countryDialog_title}</Text>
        <View className="px-6 gap-2">
          {([
            { code: 'CO' as const, flag: '\u{1F1E8}\u{1F1F4}', label: t.settings_countryColombia },
            { code: 'US' as const, flag: '\u{1F1FA}\u{1F1F8}', label: t.settings_countryUSA },
          ]).map((option) => (
            <Pressable
              key={option.code}
              onPress={() => onSelectCountry(option.code)}
              className={cn(
                'flex-row items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-3.5',
                billCountry === option.code
                  ? 'border-primary/35 bg-primary/15'
                  : 'border-muted-foreground/12 bg-muted-foreground/[0.06]',
              )}
            >
              <Text className="text-2xl">{option.flag}</Text>
              <Text className={cn('text-lg font-semibold', billCountry === option.code ? 'text-primary' : 'text-muted-foreground')}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </TrueSheet>
  );
}

export default React.memo(CountryDialog);
