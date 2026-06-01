import type { Id } from '@convex/_generated/dataModel';

export const GROUP_TINTS_BG = [
  'bg-blue-500/10',
  'bg-purple-500/10',
  'bg-teal-500/10',
  'bg-rose-500/10',
];

export function buildGroupName(members: { isSelf?: boolean; name: string }[], selfLabel: (name: string) => string): string {
  const names = members.map((m) => m.isSelf ? selfLabel(m.name) : m.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function contactKey(contact: { contactId: Id<'contacts'> | string }): string {
  return String(contact.contactId);
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
