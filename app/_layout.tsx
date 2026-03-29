import '@/lib/polyfills';
import '../global.css';
import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { ConvexProvider } from 'convex/react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { convex } from '@/lib/convex';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { colorScheme, setColorScheme } = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const hasCompletedSetup = useSettingsStore((s) => s.hasCompletedSetup);
  const isDark = colorScheme === 'dark';

  // Sync persisted theme preference on mount
  useEffect(() => {
    if (mode !== 'system') {
      setColorScheme(mode);
    }
  }, [mode, setColorScheme]);

  // Auth routing guard
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inSetup = (segments[0] as string) === 'setup';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && !hasCompletedSetup && !inSetup) {
      router.replace('/setup');
    } else if (user && hasCompletedSetup && (inAuthGroup || inSetup)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, hasCompletedSetup]);

  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="setup" options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="bills/new" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <PortalHost />
        </ThemeProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <KeyboardProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </KeyboardProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
