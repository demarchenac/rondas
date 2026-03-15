import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import { digest } from 'expo-crypto';

polyfillWebCrypto();

if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: { digest } as SubtleCrypto,
    writable: true,
    configurable: true,
  });
}
