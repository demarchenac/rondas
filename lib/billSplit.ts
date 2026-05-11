import { computeBase, computeTax, type TaxConfig } from '@/constants/taxes';

interface BillItem {
  id?: string;
  subtotal: number;
}

interface ContactItemRef {
  itemId: string;
  units: number;
}

interface ContactRef {
  items: ContactItemRef[];
}

export function computeContactTotal(
  contact: { items: ContactItemRef[] },
  billItems: BillItem[],
  allContacts: ContactRef[],
  taxConfig: TaxConfig,
  tipPercent: number,
  positiveTotal: number,
  discountTotal: number,
): number {
  const contactItemsTotal = contact.items.reduce((sum, ref) => {
    const item = billItems.find((i) => i.id === ref.itemId);
    if (!item) return sum;
    const totalAssignedUnits = allContacts.reduce((u, c) => {
      const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
      return u + (cRef ? cRef.units : 0);
    }, 0);
    const share = totalAssignedUnits > 0
      ? (ref.units / totalAssignedUnits) * item.subtotal
      : item.subtotal;
    return sum + Math.round(share);
  }, 0);

  const share = positiveTotal > 0 ? contactItemsTotal / positiveTotal : 0;
  const withDiscount = contactItemsTotal + Math.round(discountTotal * share);

  const base = computeBase(withDiscount, taxConfig);
  const tax = computeTax(withDiscount, taxConfig);
  const tip = base * (tipPercent / 100);
  return base + tax + tip;
}
