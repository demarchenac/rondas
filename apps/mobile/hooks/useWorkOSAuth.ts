import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getAccessToken } from '@/lib/auth';

export function useWorkOSAuth() {
  const { user, isLoading } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      return await getAccessToken();
    },
    [user],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken],
  );
}
