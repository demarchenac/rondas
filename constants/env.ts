function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const ENV = {
  CONVEX_URL: requireEnv('EXPO_PUBLIC_CONVEX_URL'),
  WORKOS_CLIENT_ID: requireEnv('EXPO_PUBLIC_WORKOS_CLIENT_ID'),
  REDIRECT_URI: process.env.EXPO_PUBLIC_REDIRECT_URI ?? 'rondas://callback',
} as const;
