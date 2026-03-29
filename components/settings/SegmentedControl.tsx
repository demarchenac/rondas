import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-lg bg-muted p-0.5">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5',
            value === opt.value && 'bg-card shadow-sm shadow-black/10',
          )}
        >
          <Text
            className={cn(
              'text-xs font-medium',
              value === opt.value ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
