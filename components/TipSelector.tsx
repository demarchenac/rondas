import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';

const TIP_OPTIONS = [0, 5, 10, 15, 18, 20] as const;

interface TipSelectorProps {
  value: number;
  onSelect: (percent: number) => void;
}

export function TipSelector({ value, onSelect }: TipSelectorProps) {
  const t = useT();

  return (
    <View>
      <View className="flex-row items-center gap-3 mb-3">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <IconSymbol name="percent" size={18} color="#f59e0b" />
        </View>
        <Text className="text-base text-foreground">{t.settings_tipPercentage}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TIP_OPTIONS.map((pct) => (
          <Pressable
            key={pct}
            onPress={() => onSelect(pct)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: value === pct ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
              borderWidth: 1.5,
              borderColor: value === pct ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: value === pct ? '#38bdf8' : '#64748b',
              }}
            >
              {pct}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
