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
import { CustomAlertProvider } from '@/components/ui/custom-alert';
import { KeyboardToolbar } from '@/components/ui/KeyboardToolbar';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useSubscriptionSync } from '@/hooks/useSubscriptionSync';
import DevLogViewer from '@/components/DevLogViewer';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  enableLogs: true,
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
      <SubscriptionSyncBridge userId={user?.id} />
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="setup" options={{ presentation: 'modal', gestureEnabled: false }} />
          <Stack.Screen name="bills/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bills/share" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <KeyboardToolbar />
        <DevLogViewer />
        <PortalHost />
      </ThemeProvider>
    </ConvexProvider>
  );
}

function SubscriptionSyncBridge({ userId }: { userId?: string }) {
  useSubscriptionSync(userId);
  return null;
}

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <ErrorBoundary>
        <OfflineBanner />
        <KeyboardProvider>
          <AuthProvider>
            <CustomAlertProvider>
              <RootLayoutNav />
            </CustomAlertProvider>
          </AuthProvider>
        </KeyboardProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
});
