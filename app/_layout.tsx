import '@/lib/polyfills';
import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://2292b3138ea83933a76d4bac6a9a89d9@o4511188898807808.ingest.us.sentry.io/4511188908900352',
  sendDefaultPii: true,
  enableLogs: true,
});

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f59e0b' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Step 2a: Sentry + Polyfills</Text>
          <Text style={{ color: '#fef3c7', marginTop: 8 }}>No Auth, no Convex</Text>
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
});
