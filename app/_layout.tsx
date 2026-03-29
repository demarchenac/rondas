import '@/lib/polyfills';
import '../global.css';
import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { ConvexProvider } from 'convex/react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { convex } from '@/lib/convex';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function RootLayoutNav() {
  const { user, loading } = useAuth();
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

  useAuthRedirect({ user, loading, hasCompletedSetup });

  return (
    <ConvexProvider client={convex}>
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
