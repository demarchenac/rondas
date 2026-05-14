/**
 * Normalize a phone number to E.164 format for WhatsApp deep links.
 * Default country code is 57 (Colombia).
 */
export function toE164(phone: string, defaultCountryCode = '57'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith(defaultCountryCode)) return digits;
  if (digits.startsWith('0')) return defaultCountryCode + digits.slice(1);
  return defaultCountryCode + digits;
}
