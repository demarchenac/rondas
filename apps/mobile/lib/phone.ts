/**
 * Normalize a phone number to E.164 format for WhatsApp deep links.
 * Default country code is 57 (Colombia).
 */
const COUNTRY_CODES_BY_LENGTH = [
  { code: '593', localLen: 9 },
  { code: '57', localLen: 10 },
  { code: '55', localLen: 11 },
  { code: '58', localLen: 10 },
  { code: '56', localLen: 9 },
  { code: '54', localLen: 10 },
  { code: '52', localLen: 10 },
  { code: '49', localLen: 11 },
  { code: '44', localLen: 10 },
  { code: '34', localLen: 9 },
  { code: '33', localLen: 9 },
  { code: '1', localLen: 10 },
];

function detectCountryCode(digits: string): { code: string; local: string } | null {
  for (const { code, localLen } of COUNTRY_CODES_BY_LENGTH) {
    if (digits.startsWith(code) && digits.length === code.length + localLen) {
      return { code, local: digits.slice(code.length) };
    }
  }
  return null;
}

export function toE164(phone: string, defaultCountryCode = '57'): string {
  const digits = phone.replace(/\D/g, '');
  const detected = detectCountryCode(digits);
  if (detected) return digits;
  if (digits.startsWith('0')) return defaultCountryCode + digits.slice(1);
  return defaultCountryCode + digits;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;

  const detected = detectCountryCode(digits);
  const countryCode = detected?.code ?? '';
  const local = detected?.local ?? digits;

  const carrier = local.slice(0, 3);
  const mid = local.slice(3, 6);
  const last = local.slice(6);

  const number = last ? `${carrier} ${mid}-${last}` : `${carrier}-${mid}`;
  return countryCode ? `(+${countryCode}) ${number}` : number;
}
