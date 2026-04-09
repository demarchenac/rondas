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
import OfflineBanner from '@/components/OfflineBanner';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://2292b3138ea83933a76d4bac6a9a89d9@o4511188898807808.ingest.us.sentry.io/4511188908900352',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="setup" options={{ presentation: 'modal', gestureEnabled: false }} />
          <Stack.Screen name="bills/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <PortalHost />
      </ThemeProvider>
    </ConvexProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <ErrorBoundary>
        <OfflineBanner />
        <KeyboardProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </KeyboardProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
});
