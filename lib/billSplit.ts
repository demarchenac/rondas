import { computeBase, computeTax, type TaxConfig } from '@/constants/taxes';

interface BillItem {
  id?: string;
  subtotal: number;
}

interface ContactRef {
  items: string[];
}

/**
 * Compute what a single contact owes on a bill.
 * Splits shared items evenly among all contacts assigned to that item,
 * then applies tax and tip proportionally.
 */
export function computeContactTotal(
  contact: { items: string[] },
  billItems: BillItem[],
  allContacts: ContactRef[],
  taxConfig: TaxConfig,
  tipPercent: number,
): number {
  const itemsTotal = contact.items.reduce((sum, itemId) => {
    const item = billItems.find((i) => i.id === itemId);
    if (!item) return sum;
    const splitCount = allContacts.filter((c) => c.items.includes(itemId)).length;
    return sum + Math.round(item.subtotal / Math.max(splitCount, 1));
  }, 0);

  const base = computeBase(itemsTotal, taxConfig);
  const tax = taxConfig.taxIncluded ? computeTax(itemsTotal, taxConfig) : 0;
  const tip = Math.round(base * (tipPercent / 100));
  return base + tax + tip;
}
