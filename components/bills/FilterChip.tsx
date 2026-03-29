import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';

export interface FilterChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
}

export default function FilterChip({ label, isActive, onPress, count }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 ${
        isActive ? 'bg-primary' : 'border border-border bg-card'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          isActive ? 'text-primary-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={{
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.2)',
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              color: isActive ? '#fff' : '#8b9cc0',
            }}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
