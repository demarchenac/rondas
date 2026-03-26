import '@/lib/polyfills';
import * as SecureStore from 'expo-secure-store';
import { getRandomValues, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

const WORKOS_CLIENT_ID = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID!;
const WORKOS_API_BASE = 'https://api.workos.com';
const PKCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const REDIRECT_URI = 'rondas://callback';

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

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface PkceState {
  codeVerifier: string;
  expiresAt: number;
}

// --- PKCE helpers ---

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier);
  // digestStringAsync returns hex, convert to bytes then base64url
  const bytes = hexToBytes(hash);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// --- Auth URL ---

export async function getSignInUrl(provider: string = 'authkit'): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: WORKOS_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    provider,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const pkceState: PkceState = {
    codeVerifier,
    expiresAt: Date.now() + PKCE_TTL_MS,
  };
  await SecureStore.setItemAsync(KEYS.PKCE, JSON.stringify(pkceState));

  return `${WORKOS_API_BASE}/user_management/authorize?${params.toString()}`;
}

// --- Token exchange ---

function toUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as string,
    email: raw.email as string,
    firstName: (raw.first_name as string) ?? null,
    lastName: (raw.last_name as string) ?? null,
    profilePictureUrl: (raw.profile_picture_url as string) ?? null,
  };
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

  const res = await fetch(`${WORKOS_API_BASE}/user_management/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: WORKOS_CLIENT_ID,
      code,
      code_verifier: pkceState.codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Authentication failed: ${err}`);
  }

  const data = await res.json();
  await SecureStore.deleteItemAsync(KEYS.PKCE);

  const session: StoredSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: toUser(data.user),
  };
  await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(session));

  return session.user;
}

// --- Token refresh ---

async function refreshSession(session: StoredSession): Promise<StoredSession | null> {
  try {
    const res = await fetch(`${WORKOS_API_BASE}/user_management/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: WORKOS_CLIENT_ID,
        refresh_token: session.refreshToken,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newSession: StoredSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: toUser(data.user),
    };
    await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(newSession));
    return newSession;
  } catch {
    return null;
  }
}

// --- JWT helpers ---

function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1];
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized));
}

// --- Session management ---

export async function getUser(): Promise<User | null> {
  const sessionData = await SecureStore.getItemAsync(KEYS.SESSION);
  if (!sessionData) return null;

  const session: StoredSession = JSON.parse(sessionData);

  const payload = parseJwtPayload(session.accessToken);
  const exp = payload.exp as number;
  const isExpired = Date.now() > exp * 1000 - 10_000;

  if (isExpired) {
    const refreshed = await refreshSession(session);
    if (!refreshed) {
      await clearSession();
      return null;
    }
    return refreshed.user;
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
  return `${WORKOS_API_BASE}/user_management/sessions/logout?session_id=${sessionId}`;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.SESSION);
  await SecureStore.deleteItemAsync(KEYS.PKCE);
}
