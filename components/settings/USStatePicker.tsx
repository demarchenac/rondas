import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, TouchableWithoutFeedback, View } from 'react-native';
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
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return states;
    const q = search.toLowerCase();
    return states.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelect = (code: string) => {
    onSelect(code);
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback>
            <View className="mx-8 w-80 max-h-[70%] rounded-2xl border border-border bg-card p-6">
              <Text className="mb-3 text-center text-lg font-bold text-foreground">
                {t.settings_selectState}
              </Text>

              {/* Search */}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.settings_selectState}
                placeholderTextColor={iconColors.mutedLight}
                className="mb-3 rounded-[10px] border border-muted-foreground/40 px-3 py-2 text-sm text-foreground"
              />

              {/* List */}
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelect(item.code)}
                    className={cn(
                      'flex-row items-center justify-between rounded-xl border-[1.5px] px-4 py-3',
                      selected === item.code
                        ? 'border-primary/35 bg-primary/15'
                        : 'border-transparent',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm',
                        selected === item.code ? 'font-semibold text-primary' : 'font-normal text-foreground',
                      )}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-xs font-medium text-muted-foreground">
                      {item.code}
                    </Text>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View className="h-1" />}
              />

              <Pressable onPress={handleClose} className="mt-4 items-center rounded-xl bg-muted py-3">
                <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default USStatePicker;
