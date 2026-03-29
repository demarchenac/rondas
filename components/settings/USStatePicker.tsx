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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback>
            <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6" style={{ maxHeight: '70%' }}>
              <Text className="mb-3 text-center text-lg font-bold text-foreground">
                {t.settings_selectState}
              </Text>

              {/* Search */}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.settings_selectState}
                placeholderTextColor={iconColors.mutedLight}
                style={{
                  fontSize: 14,
                  color: iconColors.foreground,
                  borderWidth: 1,
                  borderColor: iconColors.mutedLight,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 12,
                }}
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
                      style={{
                        fontSize: 14,
                        fontWeight: selected === item.code ? '600' : '400',
                        color: selected === item.code ? iconColors.primary : iconColors.foreground,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: iconColors.mutedLight,
                      }}
                    >
                      {item.code}
                    </Text>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
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
