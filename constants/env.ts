// In React Native production builds, Metro inlines process.env.EXPO_PUBLIC_*
// references at compile time. Dynamic access via process.env[key] does NOT work
// because process.env is an empty object at runtime in production bytecode.
// All references must be STATIC (literal property access).

export const ENV = {
  CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL!,
  WORKOS_CLIENT_ID: process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID!,
  REDIRECT_URI: process.env.EXPO_PUBLIC_WORKOS_REDIRECT_URI ?? "rondas://auth/callback",
} as const;
