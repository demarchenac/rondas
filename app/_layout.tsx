import '@/lib/polyfills';
import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { ConvexProvider } from 'convex/react';
import { AuthProvider } from '@/lib/AuthContext';
import { convex } from '@/lib/convex';

Sentry.init({
  dsn: 'https://2292b3138ea83933a76d4bac6a9a89d9@o4511188898807808.ingest.us.sentry.io/4511188908900352',
  sendDefaultPii: true,
  enableLogs: true,
});

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthProvider>
          <ConvexProvider client={convex}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Step 2c: + Auth</Text>
              <Text style={{ color: '#fecaca', marginTop: 8 }}>AuthProvider added</Text>
            </View>
          </ConvexProvider>
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
