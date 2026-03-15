import { WorkOS } from '@workos-inc/node';
import * as SecureStore from 'expo-secure-store';

const WORKOS_CLIENT_ID = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID!;
const PKCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const REDIRECT_URI = 'rondas://callback';

const workos = new WorkOS({ clientId: WORKOS_CLIENT_ID });

const KEYS = {
  SESSION: 'workos_session',
  PKCE: 'workos_pkce',
} as const;

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

function toUser(workosUser: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}): User {
  return {
    id: workosUser.id,
    email: workosUser.email,
    firstName: workosUser.firstName ?? null,
    lastName: workosUser.lastName ?? null,
    profilePictureUrl: workosUser.profilePictureUrl ?? null,
  };
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface PkceState {
  codeVerifier: string;
  expiresAt: number;
}

export async function getSignInUrl(): Promise<string> {
  const { url, codeVerifier } =
    await workos.userManagement.getAuthorizationUrlWithPKCE({
      redirectUri: REDIRECT_URI,
      provider: 'authkit',
    });

  const pkceState: PkceState = {
    codeVerifier,
    expiresAt: Date.now() + PKCE_TTL_MS,
  };
  await SecureStore.setItemAsync(KEYS.PKCE, JSON.stringify(pkceState));

  return url;
}

export async function handleCallback(code: string): Promise<User> {
  const pkceData = await SecureStore.getItemAsync(KEYS.PKCE);
  if (!pkceData) {
    throw new Error('No PKCE state found - please try signing in again');
  }

  const pkceState: PkceState = JSON.parse(pkceData);
  if (pkceState.expiresAt < Date.now()) {
    await SecureStore.deleteItemAsync(KEYS.PKCE);
    throw new Error('Authentication session expired - please try again');
  }

  const auth = await workos.userManagement.authenticateWithCode({
    code,
    codeVerifier: pkceState.codeVerifier,
  });

  await SecureStore.deleteItemAsync(KEYS.PKCE);

  const session: StoredSession = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    user: toUser(auth.user),
  };
  await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(session));

  return session.user;
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1];
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized));
}

export async function getUser(): Promise<User | null> {
  const sessionData = await SecureStore.getItemAsync(KEYS.SESSION);
  if (!sessionData) return null;

  const session: StoredSession = JSON.parse(sessionData);

  const payload = parseJwtPayload(session.accessToken);
  const exp = payload.exp as number;
  const isExpired = Date.now() > exp * 1000 - 10000;

  if (isExpired) {
    try {
      const refreshed =
        await workos.userManagement.authenticateWithRefreshToken({
          refreshToken: session.refreshToken,
        });

      const newSession: StoredSession = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        user: toUser(refreshed.user),
      };
      await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(newSession));
      return newSession.user;
    } catch {
      await clearSession();
      return null;
    }
  }

  return session.user;
}

export async function getSessionId(): Promise<string | null> {
  const sessionData = await SecureStore.getItemAsync(KEYS.SESSION);
  if (!sessionData) return null;

  try {
    const session: StoredSession = JSON.parse(sessionData);
    const payload = parseJwtPayload(session.accessToken);
    return (payload.sid as string) ?? null;
  } catch {
    return null;
  }
}

export function getLogoutUrl(sessionId: string): string {
  return `https://api.workos.com/user_management/sessions/logout?session_id=${sessionId}`;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.SESSION);
  await SecureStore.deleteItemAsync(KEYS.PKCE);
}
