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

// Import ENV object (triggers requireEnv calls)
import { ENV } from '@/constants/env';

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
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d946ef' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>Step 2c-5: ENV object</Text>
            <Text style={{ color: '#f5d0fe', marginTop: 8 }}>WORKOS_ID: {ENV.WORKOS_CLIENT_ID.slice(0, 15)}...</Text>
            <Text style={{ color: '#f5d0fe', marginTop: 4 }}>REDIRECT: {ENV.REDIRECT_URI}</Text>
          </View>
        </ConvexProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
