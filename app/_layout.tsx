import { Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Rondas — Minimal Test</Text>
      <Text style={{ color: '#666', marginTop: 8 }}>If you see this, the build works.</Text>
    </View>
  );
}
