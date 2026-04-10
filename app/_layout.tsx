import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Step 1: Providers</Text>
          <Text style={{ color: '#666', marginTop: 8 }}>GestureHandler + Keyboard + Reanimated + NativeWind</Text>
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
