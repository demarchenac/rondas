import '../global.css';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Step 1: Providers</Text>
          <Text style={{ color: '#bfdbfe', marginTop: 8 }}>GestureHandler + Keyboard + Reanimated + NativeWind</Text>
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
