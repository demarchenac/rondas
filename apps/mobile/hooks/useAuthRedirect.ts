import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

interface AuthRedirectParams {
  user: unknown;
  loading: boolean;
  hasCompletedSetup: boolean;
}

export function useAuthRedirect({ user, loading, hasCompletedSetup }: AuthRedirectParams) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'auth';
    const inSetup = (segments[0] as string) === 'setup';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && !hasCompletedSetup && !inSetup) {
      router.replace('/setup');
    } else if (user && hasCompletedSetup && (inAuthGroup || inSetup)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, hasCompletedSetup]);
}
