import { View, ActivityIndicator } from 'react-native';

export default function AuthCallback() {
  // AuthContext's Linking.addEventListener handles the code exchange.
  // useAuthRedirect in _layout.tsx navigates after auth completes.
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
    </View>
  );
}
