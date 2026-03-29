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
        console.error('Failed to load stored session:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      if (parsed.path !== 'callback') return;

      const error = parsed.queryParams?.error as string | undefined;
      if (error) {
        console.error('OAuth error:', error, parsed.queryParams?.error_description);
        return;
      }

      const code = parsed.queryParams?.code as string | undefined;
      if (!code) {
        console.error('No authorization code in callback');
        return;
      }

      setLoading(true);
      try {
        const newUser = await handleCallback(code);
        await syncAfterLogin(newUser);
        setUser(newUser);
      } catch (err) {
        console.error('Auth callback failed:', err);
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
      console.log('[Auth] Opening browser for provider:', provider ?? 'authkit');
      const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
      console.log('[Auth] Browser result type:', result.type);

      if (result.type !== 'success' || !result.url) {
        return { success: false, error: `Authentication was cancelled (${result.type})` };
      }

      console.log('[Auth] Callback URL:', result.url);
      const parsed = Linking.parse(result.url);
      const error = parsed.queryParams?.error as string | undefined;
      if (error) {
        const errorDesc = parsed.queryParams?.error_description as string;
        console.error('[Auth] OAuth error:', error, errorDesc);
        return { success: false, error: errorDesc || error };
      }

      const code = parsed.queryParams?.code as string | undefined;
      if (!code) {
        console.error('[Auth] No code in params:', JSON.stringify(parsed.queryParams));
        return { success: false, error: 'No authorization code received' };
      }

      console.log('[Auth] Got code, exchanging token...');
      const newUser = await handleCallback(code);
      console.log('[Auth] Authenticated user:', newUser.email);
      await syncAfterLogin(newUser);
      setUser(newUser);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Sign-in error:', error);
      return { success: false, error: String(error) };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const sessionId = await getSessionId();
      await clearSession();
      setUser(null);

      if (sessionId) {
        await WebBrowser.openBrowserAsync(getLogoutUrl(sessionId));
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
