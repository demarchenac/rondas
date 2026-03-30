import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  getSignInUrl,
  handleCallback,
  getUser,
  clearSession,
  getSessionId,
  getLogoutUrl,
  REDIRECT_URI,
  LOGOUT_REDIRECT_URI,
  type User,
} from './auth';
import { convex } from './convex';
import { api } from '@/convex/_generated/api';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useThemeStore } from '@/stores/useThemeStore';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (provider?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * After login, check if user exists in Convex and has config.
 * - Exists + has config → load config locally, mark setup complete
 * - Exists + no config → needs setup
 * - Doesn't exist → create user, needs setup
 */
async function syncAfterLogin(user: User): Promise<void> {
  const existing = await convex.query(api.users.getByWorkosId, { workosId: user.id });

  if (existing?.config) {
    // Load remote config into local stores
    const c = existing.config;
    const settings = useSettingsStore.getState();
    settings.setCountry(c.country as 'CO' | 'US');
    if (c.usState) settings.setUsState(c.usState);
    settings.setDefaultTipPercent(c.defaultTipPercent);
    settings.setLanguage(c.language as 'en' | 'es');
    settings.setExtractPhotoTime(c.extractPhotoTime);
    settings.setUseLocation(c.useLocation);
    useThemeStore.getState().setMode(c.theme as 'light' | 'dark' | 'system');
    settings.setHasCompletedSetup(true);
  } else {
    // Create user if doesn't exist (idempotent)
    await convex.mutation(api.users.createUser, {
      workosId: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      avatarUrl: user.profilePictureUrl ?? undefined,
    });
    // hasCompletedSetup stays false → setup dialog will show
    useSettingsStore.getState().setHasCompletedSetup(false);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser()
      .then(async (storedUser) => {
        if (storedUser) {
          await syncAfterLogin(storedUser);
        }
        setUser(storedUser);
      })
      .catch((error) => {
        if (__DEV__) console.error('Failed to load stored session:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      // rondas://auth/callback → hostname='auth', path='callback'
      // rondas://callback (legacy) → hostname='callback', path=null
      const isCallback = parsed.path === 'callback' || parsed.hostname === 'callback';
      if (!isCallback) return;

      const error = parsed.queryParams?.error as string | undefined;
      if (error) {
        if (__DEV__) console.error('OAuth error:', error, parsed.queryParams?.error_description);
        setLoading(false);
        return;
      }

      const code = parsed.queryParams?.code as string | undefined;
      if (!code) {
        if (__DEV__) console.error('No authorization code in callback');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const newUser = await handleCallback(code);
        await syncAfterLogin(newUser);
        setUser(newUser);
      } catch (err) {
        if (__DEV__) console.error('Auth callback failed:', err);
      } finally {
        setLoading(false);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (provider?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const url = await getSignInUrl(provider);
      if (__DEV__) console.log('[Auth] Opening browser for provider:', provider ?? 'authkit');
      const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
      if (__DEV__) console.log('[Auth] Browser result type:', result.type);

      if (result.type === 'cancel') {
        setLoading(false);
        return { success: false, error: 'Authentication was cancelled' };
      }

      // On Android, OAuth redirects often return 'dismiss' even when successful.
      // The deep link handler (Linking.addEventListener) picks up the callback
      // independently, so 'dismiss' is not an error — keep loading state active
      // and let the deep link handler complete authentication.
      // Safety timeout: if deep link doesn't arrive within 15s, clear loading.
      if (result.type !== 'success' || !result.url) {
        setTimeout(() => setLoading(false), 15_000);
        return { success: true };
      }

      const parsed = Linking.parse(result.url);
      const error = parsed.queryParams?.error as string | undefined;
      if (error) {
        const errorDesc = parsed.queryParams?.error_description as string;
        if (__DEV__) console.error('[Auth] OAuth error:', error, errorDesc);
        setLoading(false);
        return { success: false, error: errorDesc || error };
      }

      const code = parsed.queryParams?.code as string | undefined;
      if (!code) {
        if (__DEV__) console.error('[Auth] No code in callback params');
        setLoading(false);
        return { success: false, error: 'No authorization code received' };
      }

      if (__DEV__) console.log('[Auth] Got code, exchanging token...');
      const newUser = await handleCallback(code);
      await syncAfterLogin(newUser);
      setUser(newUser);
      setLoading(false);
      return { success: true };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign-in error:', error);
      setLoading(false);
      return { success: false, error: String(error) };
    }
  }, []);

  const signOut = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const sessionId = await getSessionId();
      await clearSession();
      setUser(null);

      if (sessionId) {
        await WebBrowser.openAuthSessionAsync(getLogoutUrl(sessionId), LOGOUT_REDIRECT_URI);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
