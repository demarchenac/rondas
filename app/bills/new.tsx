import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

export default function NewBillScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-background px-8 dark:bg-dark-bg"
      style={{ paddingTop: insets.top }}
    >
      <Text className="text-lg font-semibold text-foreground dark:text-dark-fg">
        New Bill
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground dark:text-dark-muted-fg">
        {imageUri ? 'Image captured — AI scanning coming in Phase 4' : 'No image selected'}
      </Text>
    </View>
  );
}
