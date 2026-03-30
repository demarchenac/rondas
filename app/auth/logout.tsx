import { Redirect } from 'expo-router';

export default function AuthLogout() {
  // User is already cleared from state before WorkOS redirects here.
  return <Redirect href="/(auth)/login" />;
}
