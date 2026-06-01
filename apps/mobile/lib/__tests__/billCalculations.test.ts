import { describe, it, expect } from 'vitest';
import {
  computeBase,
  computeTax,
  getTaxConfig,
  withTaxIncludedOverride,
  computeContactItemShare,
  toE164,
  formatPhone,
  formatCurrency,
  parseCurrency,
  getTaxLabel,
  stateLabel,
} from '../billCalculations';
import type { TaxConfig } from '@/constants/taxes';

// Minimal mock translations for getTaxLabel / stateLabel tests
const mockT = {
  tax_impoconsumo: 'ICO (incl.)',
  tax_impoconsumoSeparate: 'ICO (sep.)',
  tax_iva: 'IVA (incl.)',
  tax_ivaSeparate: 'IVA (sep.)',
  tax_salesTax: 'Sales Tax',
  state_draft: 'Draft',
  state_unsplit: 'Unsplit',
  state_split: 'Split',
  state_unresolved: 'Unresolved',
} as any;

// ---------------------------------------------------------------------------
// computeBase
// ---------------------------------------------------------------------------
describe('computeBase', () => {
  it('extracts base from tax-included price (CO dining 8%)', () => {
    const config = getTaxConfig('CO', 'dining'); // 8% included
    // $25,350 COP dinner → base = 25350 / 1.08 ≈ 23472.22
    const base = computeBase(25350, config);
    expect(base).toBeCloseTo(23472.22, 0);
  });

  it('returns amount unchanged when tax is separate (US)', () => {
    const config = getTaxConfig('US', 'dining'); // tax not included
    expect(computeBase(25350, config)).toBe(25350);
  });

  it('handles CO retail with 19% IVA included', () => {
    const config = getTaxConfig('CO', 'retail');
    // 100,000 / 1.19 ≈ 84033.61
    expect(computeBase(100_000, config)).toBeCloseTo(84033.61, 0);
  });
});

// ---------------------------------------------------------------------------
// computeTax
// ---------------------------------------------------------------------------
describe('computeTax', () => {
  it('computes 8% impoconsumo on a CO dining bill', () => {
    const config = getTaxConfig('CO', 'dining');
    // tax = base * 0.08 = (25350 / 1.08) * 0.08 ≈ 1877.78
    const tax = computeTax(25350, config);
    expect(tax).toBeCloseTo(1877.78, 0);
  });

  it('computes 19% IVA on a CO retail bill', () => {
    const config = getTaxConfig('CO', 'retail');
    // tax = (100000 / 1.19) * 0.19 ≈ 15966.39
    const tax = computeTax(100_000, config);
    expect(tax).toBeCloseTo(15966.39, 0);
  });

  it('returns 0 tax for US dining (rate is 0)', () => {
    const config = getTaxConfig('US', 'dining');
    expect(computeTax(25350, config)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTaxConfig
// ---------------------------------------------------------------------------
describe('getTaxConfig', () => {
  it('returns impoconsumo 8% for CO dining', () => {
    const config = getTaxConfig('CO', 'dining');
    expect(config.taxRate).toBe(0.08);
    expect(config.taxIncluded).toBe(true);
    expect(config.taxLabel).toContain('Impoconsumo');
  });

  it('returns IVA 19% for CO retail', () => {
    const config = getTaxConfig('CO', 'retail');
    expect(config.taxRate).toBe(0.19);
    expect(config.taxIncluded).toBe(true);
    expect(config.taxLabel).toContain('IVA');
  });

  it('returns Sales Tax for US dining', () => {
    const config = getTaxConfig('US', 'dining');
    expect(config.taxRate).toBe(0);
    expect(config.taxIncluded).toBe(false);
    expect(config.taxLabel).toBe('Sales Tax');
  });
});

// ---------------------------------------------------------------------------
// withTaxIncludedOverride
// ---------------------------------------------------------------------------
describe('withTaxIncludedOverride', () => {
  it('flips taxIncluded from true to false and updates label', () => {
    const config = getTaxConfig('CO', 'dining'); // taxIncluded: true, label has "(included)"
    const overridden = withTaxIncludedOverride(config, false);
    expect(overridden.taxIncluded).toBe(false);
    expect(overridden.taxLabel).toContain('(separate)');
    expect(overridden.taxLabel).not.toContain('(included)');
  });

  it('returns same config when override matches current value', () => {
    const config = getTaxConfig('CO', 'dining');
    const same = withTaxIncludedOverride(config, true);
    expect(same).toBe(config); // same reference
  });

  it('returns same config when override is undefined', () => {
    const config = getTaxConfig('CO', 'dining');
    expect(withTaxIncludedOverride(config)).toBe(config);
  });
});

// ---------------------------------------------------------------------------
// computeContactItemShare
// ---------------------------------------------------------------------------
describe('computeContactItemShare', () => {
  const billItems = [
    { id: 'item-1', name: 'Bandeja Paisa', quantity: 1, subtotal: 25350 },
    { id: 'item-2', name: 'Limonada', quantity: 3, subtotal: 12000 },
  ];

  it('returns full subtotal when one contact takes all units', () => {
    const result = computeContactItemShare(
      { itemId: 'item-1', units: 1 },
      billItems,
      [{ items: [{ itemId: 'item-1', units: 1 }] }],
    );
    expect(result).not.toBeNull();
    expect(result!.share).toBe(25350);
    expect(result!.name).toBe('Bandeja Paisa');
  });

  it('splits evenly when two contacts share an item', () => {
    const contacts = [
      { items: [{ itemId: 'item-2', units: 1 }] },
      { items: [{ itemId: 'item-2', units: 2 }] },
    ];
    const share1 = computeContactItemShare({ itemId: 'item-2', units: 1 }, billItems, contacts);
    const share2 = computeContactItemShare({ itemId: 'item-2', units: 2 }, billItems, contacts);
    expect(share1!.share).toBe(4000);  // 1/3 * 12000 = 4000
    expect(share2!.share).toBe(8000);  // 2/3 * 12000 = 8000
  });

  it('returns null for a non-existent item', () => {
    const result = computeContactItemShare(
      { itemId: 'item-999', units: 1 },
      billItems,
      [{ items: [{ itemId: 'item-999', units: 1 }] }],
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toE164
// ---------------------------------------------------------------------------
describe('toE164', () => {
  it('adds 57 country code to a Colombian local number', () => {
    expect(toE164('3001234567')).toBe('573001234567');
  });

  it('returns already-E.164 Colombian number unchanged', () => {
    expect(toE164('573001234567')).toBe('573001234567');
  });

  it('strips leading 0 and adds country code', () => {
    expect(toE164('03001234567')).toBe('573001234567');
  });

  it('handles US number with country code 1', () => {
    expect(toE164('12125551234')).toBe('12125551234');
  });

  it('adds default country code to short local number', () => {
    expect(toE164('3101234567')).toBe('573101234567');
  });
});

// ---------------------------------------------------------------------------
// formatPhone
// ---------------------------------------------------------------------------
describe('formatPhone', () => {
  it('formats a Colombian mobile number', () => {
    const result = formatPhone('573001234567');
    expect(result).toBe('(+57) 300 123-4567');
  });

  it('formats a US number', () => {
    const result = formatPhone('12125551234');
    expect(result).toBe('(+1) 212 555-1234');
  });

  it('returns short numbers as-is', () => {
    expect(formatPhone('12345')).toBe('12345');
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats COP with no decimals by default', () => {
    const result = formatCurrency(25350, 'CO');
    // COP uses dot as thousands separator in es-CO locale
    expect(result).toBe('$25.350 COP'); // dot is thousands separator in es-CO
    expect(result).not.toContain(',');  // no decimal comma for 0 decimal places
  });

  it('formats USD with 2 decimals by default', () => {
    const result = formatCurrency(12.5, 'US');
    expect(result).toContain('12.50');
    expect(result).toContain('USD');
  });

  it('respects custom decimalPlaces override', () => {
    const result = formatCurrency(25350, 'CO', 2);
    // Should have a decimal portion now
    expect(result).toContain('COP');
  });
});

// ---------------------------------------------------------------------------
// parseCurrency
// ---------------------------------------------------------------------------
describe('parseCurrency', () => {
  it('parses COP formatted string', () => {
    expect(parseCurrency('$25.350 COP', 'CO')).toBe(25350);
  });

  it('parses USD formatted string', () => {
    expect(parseCurrency('$12.50 USD', 'US')).toBe(12.5);
  });

  it('returns 0 for empty/invalid input', () => {
    expect(parseCurrency('', 'CO')).toBe(0);
    expect(parseCurrency('abc', 'US')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTaxLabel
// ---------------------------------------------------------------------------
describe('getTaxLabel', () => {
  it('returns localized label for CO impoconsumo', () => {
    const config = getTaxConfig('CO', 'dining');
    expect(getTaxLabel(config, mockT)).toBe('ICO (incl.)');
  });

  it('returns localized label for US sales tax', () => {
    const config = getTaxConfig('US', 'dining');
    expect(getTaxLabel(config, mockT)).toBe('Sales Tax');
  });

  it('falls back to raw taxLabel for unknown labels', () => {
    const custom: TaxConfig = { taxLabel: 'Custom Tax', taxRate: 0.05, taxIncluded: false, suggestedTip: 0 };
    expect(getTaxLabel(custom, mockT)).toBe('Custom Tax');
  });
});

// ---------------------------------------------------------------------------
// stateLabel
// ---------------------------------------------------------------------------
describe('stateLabel', () => {
  it('returns translated label for each state', () => {
    expect(stateLabel(mockT, 'draft')).toBe('Draft');
    expect(stateLabel(mockT, 'split')).toBe('Split');
    expect(stateLabel(mockT, 'unsplit')).toBe('Unsplit');
    expect(stateLabel(mockT, 'unresolved')).toBe('Unresolved');
  });
});
