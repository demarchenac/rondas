import type { Id, Doc } from '../_generated/dataModel';
import { getTaxConfig, computeBase, computeTax, withTaxIncludedOverride } from '../taxes';
import type { Country, ReceiptCategory } from '../taxes';

export type ContactItemRef = { itemId: string; units: number };

export type ContactRef = {
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  items: ContactItemRef[];
  amount: number;
  paid: boolean;
};

export function assertMaxLength(value: string, max: number, field: string) {
  if (value.length > max) throw new Error(`${field} exceeds maximum length of ${max}`);
}

export async function resolveContacts(
  ctx: { db: { get: (id: Id<'contacts'>) => Promise<Doc<'contacts'> | null> } },
  refs: ContactRef[],
) {
  return Promise.all(
    refs.map(async (ref) => {
      const contact = await ctx.db.get(ref.contactId);
      return {
        ...ref,
        isSelf: ref.isSelf ?? contact?.isSelf,
        name: contact?.name ?? 'Unknown',
        phone: contact?.phone,
        email: contact?.email,
        imageUri: contact?.imageUri,
      };
    }),
  );
}

export function computeBillState(
  contacts: { paid: boolean }[],
): 'unsplit' | 'split' | 'unresolved' {
  if (contacts.length === 0) return 'unsplit';
  return contacts.every((c) => c.paid) ? 'split' : 'unresolved';
}

export function computeDisplayTotal(
  items: { subtotal: number }[],
  bill: { tax?: number; tip?: number; tipPercent?: number; useCustomTip?: boolean; country?: string; taxIncludedOverride?: boolean },
  platformSlug: string = 'dining',
): number {
  const country = (bill.country as Country) || 'CO';
  const category = (platformSlug as ReceiptCategory) || 'dining';
  const rawConfig = getTaxConfig(country, category);
  const taxConfig = withTaxIncludedOverride(rawConfig, bill.taxIncludedOverride ?? undefined);
  const itemsTotal = items.reduce((subtotalSum, i) => subtotalSum + i.subtotal, 0);
  const base = computeBase(itemsTotal, taxConfig);
  const computedTax = computeTax(itemsTotal, taxConfig);
  const tipPercent = bill.tipPercent ?? 0;
  const computedTip = bill.useCustomTip ? (bill.tip ?? 0) : base * (tipPercent / 100);
  return base + computedTax + computedTip;
}

export function computeDerivedFields(
  items: { id?: string; subtotal: number }[],
  contacts: { items: ContactItemRef[]; paid: boolean }[],
) {
  const totalItemCount = items.length;
  const totalContactCount = contacts.length;
  const paidContactCount = contacts.filter((c) => c.paid).length;
  const assignedItemCount = new Set(contacts.flatMap((c) => c.items.map((i) => i.itemId))).size;
  const progress = totalItemCount > 0 ? assignedItemCount / totalItemCount : 0;
  return { totalItemCount, totalContactCount, paidContactCount, assignedItemCount, progress };
}

export function recalculateAmounts(
  items: { id?: string; quantity: number; subtotal: number }[],
  contacts: ContactRef[],
  tax: number,
  tip: number,
): ContactRef[] {
  const positiveTotal = items.reduce((positivesSum, i) => positivesSum + Math.max(0, i.subtotal), 0);
  const discountTotal = items.reduce((discountsSum, i) => discountsSum + Math.min(0, i.subtotal), 0);
  const itemsTotal = positiveTotal + discountTotal;

  for (const contact of contacts) {
    contact.items = contact.items.filter((ref) => items.some((i) => i.id === ref.itemId));

    const contactItemsTotal = contact.items.reduce((contactTotal, ref) => {
      const item = items.find((i) => i.id === ref.itemId);
      if (!item) return contactTotal;
      const effectiveTotal = item.quantity > 0
        ? (ref.units / item.quantity) * item.subtotal
        : item.subtotal;
      return contactTotal + effectiveTotal;
    }, 0);

    const share = positiveTotal > 0 ? contactItemsTotal / positiveTotal : 0;
    contact.amount = Math.round(contactItemsTotal + discountTotal * share + tax * share + tip * share);
  }

  const activeContacts = contacts.filter((c) => c.items.length > 0);

  if (activeContacts.length > 0) {
    const expectedTotal = itemsTotal + tax + tip;
    const roundedSum = activeContacts.reduce((amountsTotal, c) => amountsTotal + c.amount, 0);
    const remainder = Math.round(expectedTotal) - roundedSum;
    if (remainder !== 0) {
      activeContacts[0].amount += remainder;
    }
  }

  return activeContacts;
}

export function cleanupContactGroups(
  contacts: ContactRef[],
  contactGroups: { id: string; contactIds: Id<'contacts'>[]; name: string }[] | undefined,
): { id: string; contactIds: Id<'contacts'>[]; name: string }[] | undefined {
  if (!contactGroups || contactGroups.length === 0) return undefined;
  const contactIdSet = new Set(contacts.map((c) => String(c.contactId)));
  const cleaned = contactGroups
    .map((g) => ({ ...g, contactIds: g.contactIds.filter((id) => contactIdSet.has(String(id))) }))
    .filter((g) => g.contactIds.length >= 2);
  return cleaned.length > 0 ? cleaned : undefined;
}
