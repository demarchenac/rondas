import { computeBase, computeTax, type TaxConfig } from '@/constants/taxes';
import type { Id } from '@convex/_generated/dataModel';

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

export interface ItemShareResult {
  share: number;
  totalUnits: number;
  name: string;
}

export function computeContactItemShare(
  itemRef: { itemId: string; units: number },
  billItems: { id?: string; name: string; quantity: number; subtotal: number }[],
  _allContacts: { items: { itemId: string; units: number }[] }[],
): ItemShareResult | null {
  const billItem = billItems.find((bi) => (bi.id ?? '') === itemRef.itemId);
  if (!billItem) return null;
  const totalUnits = billItem.quantity;
  const share = totalUnits > 0
    ? Math.round((itemRef.units / totalUnits) * billItem.subtotal)
    : Math.round(billItem.subtotal);
  return { share, totalUnits, name: billItem.name };
}

export function contactKey(contact: { contactId: Id<'contacts'> | string }): string {
  return String(contact.contactId);
}

export function buildGroupName(
  members: { isSelf?: boolean; name: string }[],
  selfLabel: (name: string) => string,
): string {
  const names = members.map((m) => m.isSelf ? selfLabel(m.name) : m.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function computeUnassignedUnits(
  items: { id?: string; quantity: number }[],
  contacts: { items: { itemId: string; units: number }[] }[],
): number {
  return items.reduce((total, item) => {
    if (!item.id) return total;
    const assignedUnits = contacts.reduce((assigned, contact) => {
      const ref = contact.items.find((itemRef) => itemRef.itemId === item.id);
      return assigned + (ref ? ref.units : 0);
    }, 0);
    return total + Math.max(0, item.quantity - assignedUnits);
  }, 0);
}
