import { Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Build with EAS Updates</Text>
      <Text style={{ color: '#666', marginTop: 8 }}>Embedded bundle. Waiting for OTA...</Text>
    </View>
  );
}
