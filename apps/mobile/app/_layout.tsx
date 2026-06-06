import '@/lib/polyfills';
import '../global.css';
import { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, usePathname, useGlobalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';

import { ConvexProviderWithAuth } from 'convex/react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { convex } from '@/lib/convex';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { CustomAlertProvider } from '@/components/ui/custom-alert';
import { KeyboardToolbar } from '@/components/ui/KeyboardToolbar';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useWorkOSAuth } from '@/hooks/useWorkOSAuth';
import { useSubscriptionSync } from '@/hooks/useSubscriptionSync';
import DevLogViewer from '@/components/DevLogViewer';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  enableLogs: true,
});

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const hasCompletedSetup = useSettingsStore((s) => s.hasCompletedSetup);
  const isDark = colorScheme === 'dark';
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);

  // Sync persisted theme preference on mount
  useEffect(() => {
    if (mode !== 'system') {
      setColorScheme(mode);
    }
  }, [mode, setColorScheme]);

  // Manual screen tracking for Expo Router
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, { previous_screen: previousPathname.current ?? null, ...params });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

  useAuthRedirect({ user, isLoading, hasCompletedSetup });

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSAuth}>
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
    </ConvexProviderWithAuth>
  );
}

function SubscriptionSyncBridge({ userId }: { userId?: string }) {
  useSubscriptionSync(userId);
  return null;
}

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: false,
          captureTouches: true,
          propsToCapture: ['testID'],
        }}
      >
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
      </PostHogProvider>
    </GestureHandlerRootView>
  );
});
