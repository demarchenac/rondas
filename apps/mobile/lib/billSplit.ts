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
  const contactItemsTotal = contact.items.reduce((itemsTotal, ref) => {
    const item = billItems.find((i) => i.id === ref.itemId);
    if (!item) return itemsTotal;
    const totalAssignedUnits = allContacts.reduce((totalUnits, c) => {
      const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
      return totalUnits + (cRef ? cRef.units : 0);
    }, 0);
    const share = totalAssignedUnits > 0
      ? (ref.units / totalAssignedUnits) * item.subtotal
      : item.subtotal;
    return itemsTotal + Math.round(share);
  }, 0);

  const share = positiveTotal > 0 ? contactItemsTotal / positiveTotal : 0;
  const withDiscount = contactItemsTotal + Math.round(discountTotal * share);

  const base = computeBase(withDiscount, taxConfig);
  const tax = computeTax(withDiscount, taxConfig);
  const tip = base * (tipPercent / 100);
  return base + tax + tip;
}
