import '@/lib/polyfills';
import '../global.css';
import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import 'react-native-reanimated';

import { ConvexProvider } from 'convex/react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { convex } from '@/lib/convex';
import { queryClient } from '@/lib/queryClient';
import { useThemeStore } from '@/stores/useThemeStore';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { colorScheme, setColorScheme } = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
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

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="bills/new" options={{ title: 'New Bill', presentation: 'modal' }} />
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
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
