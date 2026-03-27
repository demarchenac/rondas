import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import { FontAwesome } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/lib/AuthContext';
import { ICON_COLORS } from '@/constants/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, loading } = useAuth();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (provider?: string) => {
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await signIn(provider);
    if (!result.success) {
      const msg = result.error ?? 'Unknown error';
      console.error('[Login] Sign-in failed:', msg);
      setError(msg);
    }
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 items-center justify-center px-8">
        {/* Branding */}
        <View className="items-center gap-3">
          <View className="h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
            <IconSymbol name="receipt" size={48} color={iconColors.primary} />
          </View>
          <Text className="text-4xl font-extrabold tracking-tight text-foreground">
            Rondas
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            Split bills, not friendships
          </Text>
        </View>

        {/* Sign-in buttons */}
        <View className="mt-12 w-full gap-3">
          {/* Email (primary) */}
          <Button
            variant="default"
            size="lg"
            className="w-full"
            disabled={loading}
            onPress={() => handleSignIn()}
          >
            <IconSymbol name="envelope.fill" size={18} color="#fff" />
            <Text>Sign in with Email</Text>
          </Button>

          {/* Divider */}
          <View className="flex-row items-center gap-3 py-1">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs text-muted-foreground">or</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          {/* Apple */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={loading}
            onPress={() => handleSignIn('AppleOAuth')}
          >
            <FontAwesome
              name="apple"
              size={18}
              color={colorScheme === 'dark' ? '#e8ecf4' : '#0f172a'}
            />
            <Text>Sign in with Apple</Text>
          </Button>

          {/* Google */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={loading}
            onPress={() => handleSignIn('GoogleOAuth')}
          >
            <FontAwesome
              name="google"
              size={16}
              color={colorScheme === 'dark' ? '#e8ecf4' : '#0f172a'}
            />
            <Text>Sign in with Google</Text>
          </Button>
        </View>

        {/* Error message */}
        {error && (
          <View className="mt-4 w-full rounded-xl bg-destructive/10 px-4 py-3">
            <Text className="text-center text-sm text-destructive">
              {error}
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="items-center pb-4">
        <Text className="text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service
        </Text>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center bg-background/80">
          <ActivityIndicator size="large" color={iconColors.primary} />
        </View>
      )}
    </View>
  );
}
