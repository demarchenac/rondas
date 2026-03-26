import { getRandomValues } from 'expo-crypto';

// Polyfill crypto.getRandomValues for libraries that depend on Web Crypto API
// (e.g., WorkOS SDK, PKCE code verifier generation)
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error -- minimal polyfill for React Native
  globalThis.crypto = {};
}

if (!globalThis.crypto.getRandomValues) {
  // @ts-expect-error -- expo-crypto's getRandomValues is compatible
  globalThis.crypto.getRandomValues = getRandomValues;
}
