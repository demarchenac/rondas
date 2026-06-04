import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { ICON_COLORS } from '@/constants/colors';
import { US_STATE_RATES } from '@/constants/taxes';
import { useT } from '@/lib/i18n';

interface USStatePickerProps {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

const states = Object.entries(US_STATE_RATES).map(([code, { name }]) => ({ code, name }));

function USStatePicker({ visible, selected, onSelect, onClose }: USStatePickerProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<TrueSheet>(null);
  const [search, setSearch] = useState('');
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSearch('');
  }

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => { setSearch(''); onClose(); }, [onClose]);

  const filtered = useMemo(() => {
    if (!search) return states;
    const query = search.toLowerCase();
    return states.filter((s) => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query));
  }, [search]);

  const handleSelect = (code: string) => {
    onSelect(code);
    sheetRef.current?.dismiss();
  };

  return (
    <TrueSheet
      ref={sheetRef}
      name="us-state-picker"
      detents={[0.6, 1]}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      scrollable
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ flex: 1, paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}>
        <Text className="px-6 pt-4 pb-3 text-2xl font-bold text-foreground">{t.settings_selectState}</Text>

        <View className="px-6 pb-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.settings_selectState}
            placeholderTextColor={iconColors.mutedLight}
            className="rounded-xl border border-muted-foreground/20 bg-muted-foreground/[0.06] px-4 py-2.5 text-base text-foreground"
          />
        </View>

        <FlashList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item.code)}
              className={cn(
                'flex-row items-center justify-between rounded-xl border-[1.5px] px-4 py-3',
                selected === item.code ? 'border-primary/35 bg-primary/15' : 'border-transparent',
              )}
            >
              <Text className={cn('text-base', selected === item.code ? 'font-semibold text-primary' : 'font-normal text-foreground')}>
                {item.name}
              </Text>
              <Text className="text-sm font-medium text-muted-foreground">{item.code}</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View className="h-1" />}
        />
      </View>
    </TrueSheet>
  );
}

export default React.memo(USStatePicker);
