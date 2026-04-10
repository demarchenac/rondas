import { Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>OTA UPDATE WORKS!</Text>
      <Text style={{ color: '#d1fae5', marginTop: 8 }}>This came from EAS Update, not the build.</Text>
    </View>
  );
}
