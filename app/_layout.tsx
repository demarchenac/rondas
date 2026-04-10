import '@/lib/polyfills';
import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { ConvexProvider } from 'convex/react';
import { convex } from '@/lib/convex';

Sentry.init({
  dsn: 'https://2292b3138ea83933a76d4bac6a9a89d9@o4511188898807808.ingest.us.sentry.io/4511188908900352',
  sendDefaultPii: true,
  enableLogs: true,
});

// Test env vars directly — don't import auth.ts
const workosId = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID ?? 'MISSING';
const redirectUri = process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI ?? 'MISSING';
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? 'MISSING';

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexProvider client={convex}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>Step 2c-3: Env Vars</Text>
            <Text style={{ color: '#ddd6fe', marginTop: 12 }}>WORKOS_CLIENT_ID: {workosId}</Text>
            <Text style={{ color: '#ddd6fe', marginTop: 4 }}>REDIRECT_URI: {redirectUri}</Text>
            <Text style={{ color: '#ddd6fe', marginTop: 4 }}>CONVEX_URL: {convexUrl.slice(0, 30)}...</Text>
          </View>
        </ConvexProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
