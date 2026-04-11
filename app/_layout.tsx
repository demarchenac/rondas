import '@/lib/polyfills';
import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { ConvexProvider } from 'convex/react';
import { convex } from '@/lib/convex';
import * as SecureStore from 'expo-secure-store';
import { getRandomValues } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Replicate requireEnv INLINE — no import from constants/env
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing: ${key}`);
  return value;
}
const WORKOS_ID = requireEnv("EXPO_PUBLIC_WORKOS_CLIENT_ID");
const REDIRECT = process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI ?? "rondas://auth/callback";

Sentry.init({
  dsn: 'https://2292b3138ea83933a76d4bac6a9a89d9@o4511188898807808.ingest.us.sentry.io/4511188908900352',
  sendDefaultPii: true,
  enableLogs: true,
});

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexProvider client={convex}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ea580c' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>Step 2c-6: Inline requireEnv</Text>
            <Text style={{ color: '#fed7aa', marginTop: 8 }}>WORKOS: {WORKOS_ID.slice(0, 15)}...</Text>
            <Text style={{ color: '#fed7aa', marginTop: 4 }}>REDIRECT: {REDIRECT}</Text>
          </View>
        </ConvexProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
