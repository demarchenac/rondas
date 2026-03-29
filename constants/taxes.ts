export type Country = 'CO' | 'US';
export type ReceiptCategory = 'dining' | 'retail' | 'service';

export interface TaxConfig {
  taxLabel: string;
  taxRate: number; // rate for informational/calculation purposes
  taxIncluded: boolean; // true = tax already in item prices (CO), false = tax is additional (US)
  suggestedTip: number; // 0 = no tip suggested
}

const CO_CONFIG: Record<ReceiptCategory, TaxConfig> = {
  dining: { taxLabel: 'Impoconsumo (included)', taxRate: 0.08, taxIncluded: true, suggestedTip: 0.10 },
  retail: { taxLabel: 'IVA (included)', taxRate: 0.19, taxIncluded: true, suggestedTip: 0 },
  service: { taxLabel: 'IVA (included)', taxRate: 0.19, taxIncluded: true, suggestedTip: 0.10 },
};

const US_CONFIG: Record<ReceiptCategory, TaxConfig> = {
  dining: { taxLabel: 'Sales Tax', taxRate: 0, taxIncluded: false, suggestedTip: 0.18 },
  retail: { taxLabel: 'Sales Tax', taxRate: 0, taxIncluded: false, suggestedTip: 0 },
  service: { taxLabel: 'Sales Tax', taxRate: 0, taxIncluded: false, suggestedTip: 0.18 },
};

export const TAX_CONFIG: Record<Country, Record<ReceiptCategory, TaxConfig>> = {
  CO: CO_CONFIG,
  US: US_CONFIG,
};

export const US_STATE_RATES: Record<string, { name: string; rate: number }> = {
  AL: { name: 'Alabama', rate: 0.04 },
  AK: { name: 'Alaska', rate: 0 },
  AZ: { name: 'Arizona', rate: 0.056 },
  AR: { name: 'Arkansas', rate: 0.065 },
  CA: { name: 'California', rate: 0.0725 },
  CO: { name: 'Colorado', rate: 0.029 },
  CT: { name: 'Connecticut', rate: 0.0635 },
  DE: { name: 'Delaware', rate: 0 },
  FL: { name: 'Florida', rate: 0.06 },
  GA: { name: 'Georgia', rate: 0.04 },
  HI: { name: 'Hawaii', rate: 0.04 },
  ID: { name: 'Idaho', rate: 0.06 },
  IL: { name: 'Illinois', rate: 0.0625 },
  IN: { name: 'Indiana', rate: 0.07 },
  IA: { name: 'Iowa', rate: 0.06 },
  KS: { name: 'Kansas', rate: 0.065 },
  KY: { name: 'Kentucky', rate: 0.06 },
  LA: { name: 'Louisiana', rate: 0.05 },
  ME: { name: 'Maine', rate: 0.055 },
  MD: { name: 'Maryland', rate: 0.06 },
  MA: { name: 'Massachusetts', rate: 0.0625 },
  MI: { name: 'Michigan', rate: 0.06 },
  MN: { name: 'Minnesota', rate: 0.06875 },
  MS: { name: 'Mississippi', rate: 0.07 },
  MO: { name: 'Missouri', rate: 0.04225 },
  MT: { name: 'Montana', rate: 0 },
  NE: { name: 'Nebraska', rate: 0.055 },
  NV: { name: 'Nevada', rate: 0.0685 },
  NH: { name: 'New Hampshire', rate: 0 },
  NJ: { name: 'New Jersey', rate: 0.06625 },
  NM: { name: 'New Mexico', rate: 0.05125 },
  NY: { name: 'New York', rate: 0.04 },
  NC: { name: 'North Carolina', rate: 0.0475 },
  ND: { name: 'North Dakota', rate: 0.05 },
  OH: { name: 'Ohio', rate: 0.0575 },
  OK: { name: 'Oklahoma', rate: 0.045 },
  OR: { name: 'Oregon', rate: 0 },
  PA: { name: 'Pennsylvania', rate: 0.06 },
  RI: { name: 'Rhode Island', rate: 0.07 },
  SC: { name: 'South Carolina', rate: 0.06 },
  SD: { name: 'South Dakota', rate: 0.045 },
  TN: { name: 'Tennessee', rate: 0.07 },
  TX: { name: 'Texas', rate: 0.0625 },
  UT: { name: 'Utah', rate: 0.061 },
  VT: { name: 'Vermont', rate: 0.06 },
  VA: { name: 'Virginia', rate: 0.053 },
  WA: { name: 'Washington', rate: 0.065 },
  WV: { name: 'West Virginia', rate: 0.06 },
  WI: { name: 'Wisconsin', rate: 0.05 },
  WY: { name: 'Wyoming', rate: 0.04 },
  DC: { name: 'Washington D.C.', rate: 0.06 },
};

export const COUNTRY_LABELS: Record<Country, string> = {
  CO: '🇨🇴 Colombia',
  US: '🇺🇸 United States',
};

export const CATEGORY_LABELS: Record<ReceiptCategory, { label: string; emoji: string }> = {
  dining: { label: 'Dining', emoji: '🍽️' },
  retail: { label: 'Retail', emoji: '🛒' },
  service: { label: 'Service', emoji: '🔧' },
};

export function getTaxConfig(country: Country, category: ReceiptCategory): TaxConfig {
  return TAX_CONFIG[country][category];
}

export function getSuggestedTip(country: Country, category: ReceiptCategory, subtotal: number): number {
  const config = getTaxConfig(country, category);
  return Math.round(subtotal * config.suggestedTip);
}

/**
 * Extract the tax amount from a tax-inclusive total.
 * When tax is included in item prices: base = total / (1 + rate), tax = base * rate
 * When tax is separate: returns the tax amount directly.
 */
export function computeTax(amount: number, taxConfig: TaxConfig): number {
  if (!taxConfig.taxIncluded) return 0;
  const base = amount / (1 + taxConfig.taxRate);
  return Math.round(base * taxConfig.taxRate);
}

/**
 * Extract the base amount (without tax) from a tax-inclusive total.
 * When tax is included: base = total / (1 + rate)
 * When tax is separate: base = total (no change)
 */
export function computeBase(amount: number, taxConfig: TaxConfig): number {
  if (!taxConfig.taxIncluded) return amount;
  return Math.round(amount / (1 + taxConfig.taxRate));
}
