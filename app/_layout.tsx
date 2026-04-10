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

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexProvider client={convex}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06b6d4' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Step 2b: + Convex</Text>
            <Text style={{ color: '#cffafe', marginTop: 8 }}>No Auth yet</Text>
          </View>
        </ConvexProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
