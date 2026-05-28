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

const COUNTRY_CODES = ['57', '1', '44', '34', '49', '33', '55', '52', '54', '56', '58', '593'];

/**
 * Format phone for display: (+57) 301 795-3720
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;

  let countryCode = '';
  let local = digits;
  for (const cc of COUNTRY_CODES) {
    if (digits.startsWith(cc) && digits.length > cc.length + 6) {
      countryCode = cc;
      local = digits.slice(cc.length);
      break;
    }
  }

  const carrier = local.slice(0, 3);
  const mid = local.slice(3, 6);
  const last = local.slice(6);

  const number = last ? `${carrier} ${mid}-${last}` : `${carrier}-${mid}`;
  return countryCode ? `(+${countryCode}) ${number}` : number;
}
