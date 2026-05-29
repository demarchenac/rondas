import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, type Country, type TaxConfig } from '@/constants/taxes';
import { getTaxLabel } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

interface ContactItemRef {
  itemId: string;
  units: number;
}

interface BillData {
  name: string;
  category?: string;
  country?: string;
  tipPercent?: number;
  splitStrategy?: string;
  numPeople?: number;
  total: number;
  location?: { address?: string };
  photoTakenAt?: string;
  _creationTime: number;
  items: { id?: string; name: string; subtotal: number }[];
  contacts: { items: ContactItemRef[] }[];
}

interface ContactData {
  name: string;
  items: ContactItemRef[];
  amount: number;
}

export function buildWhatsAppMessage(params: {
  bill: BillData;
  contact: ContactData;
  taxConfig: TaxConfig;
  t: Translations;
}): string {
  const { bill, contact, taxConfig, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';
  const tipPercent = bill.tipPercent ?? 0;
  const translatedTax = getTaxLabel(taxConfig, t);
  const sep = '─────────────';

  // Equal split: simplified message
  if (bill.splitStrategy === 'equal' && bill.numPeople) {
    const lines: string[] = [];
    lines.push(`🧾 *${bill.name}*`);
    if (bill.location?.address) lines.push(`📍 ${bill.location.address}`);
    const billDate = bill.photoTakenAt ?? new Date(bill._creationTime).toISOString();
    const d = new Date(billDate);
    if (!isNaN(d.getTime())) {
      const locale = billCountry === 'US' ? 'en-US' : 'es-CO';
      lines.push(`🕐 ${d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`);
    }
    lines.push('');
    lines.push(t.wa_equalSplit(
      formatCurrency(contact.amount, billCountry),
      formatCurrency(bill.total, billCountry),
      bill.numPeople,
    ));
    lines.push('');
    lines.push(sep);
    lines.push(t.wa_footer);
    return lines.join('\n');
  }

  // Per-contact item shares
  const itemLines = contact.items
    .map((ref) => {
      const item = bill.items.find((billItem) => billItem.id === ref.itemId);
      if (!item) return null;
      const totalAssignedUnits = bill.contacts.reduce((u, c) => {
        const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
        return u + (cRef ? cRef.units : 0);
      }, 0);
      const share = totalAssignedUnits > 0
        ? Math.round((ref.units / totalAssignedUnits) * item.subtotal)
        : Math.round(item.subtotal);
      return `- ${item.name} — ${formatCurrency(share, billCountry)}`;
    })
    .filter(Boolean)
    .join('\n');

  // Per-contact totals
  const contactItemsTotal = contact.items.reduce((sum, ref) => {
    const item = bill.items.find((billItem) => billItem.id === ref.itemId);
    if (!item) return sum;
    const totalAssignedUnits = bill.contacts.reduce((u, c) => {
      const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
      return u + (cRef ? cRef.units : 0);
    }, 0);
    const share = totalAssignedUnits > 0
      ? Math.round((ref.units / totalAssignedUnits) * item.subtotal)
      : Math.round(item.subtotal);
    return sum + share;
  }, 0);
  const contactBase = computeBase(contactItemsTotal, taxConfig);
  const contactTax = computeTax(contactItemsTotal, taxConfig);
  const contactTip = Math.round(contactBase * (tipPercent / 100));
  const contactBeforeTip = contactBase + contactTax;
  const contactTotal = contactBase + contactTax + contactTip;

  // Header
  const lines: string[] = [];
  lines.push(`🧾 *${bill.name}*`);
  if (bill.location?.address) lines.push(`📍 ${bill.location.address}`);
  const billDate = bill.photoTakenAt ?? new Date(bill._creationTime).toISOString();
  const d = new Date(billDate);
  if (!isNaN(d.getTime())) {
    const locale = billCountry === 'US' ? 'en-US' : 'es-CO';
    lines.push(`🕐 ${d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  }
  lines.push('');

  // Breakdown
  lines.push(t.wa_breakdown(contact.name));
  lines.push('');
  lines.push(itemLines);
  lines.push('');
  lines.push(`${t.wa_subtotal}: ${formatCurrency(contactBase, billCountry)}`);
  lines.push(`${translatedTax}: ${formatCurrency(contactTax, billCountry)}`);
  lines.push(sep);
  lines.push(`${t.wa_beforeTip}: ${formatCurrency(contactBeforeTip, billCountry)}`);
  if (tipPercent > 0) {
    lines.push(`${t.wa_tip(tipPercent)}: ${formatCurrency(contactTip, billCountry)}`);
  }
  lines.push(sep);
  lines.push(t.wa_total(formatCurrency(contactTotal, billCountry)));
  lines.push('');
  lines.push(t.wa_footer);

  return lines.join('\n');
}

interface GroupMember {
  name: string;
  amount: number;
}

export function buildGroupWhatsAppMessage(params: {
  bill: BillData;
  groupName: string;
  members: GroupMember[];
  groupTotal: number;
  t: Translations;
}): string {
  const { bill, groupName, members, groupTotal, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';
  const sep = '─────────────';

  const lines: string[] = [];
  lines.push(`🧾 *${bill.name}*`);
  if (bill.location?.address) lines.push(`📍 ${bill.location.address}`);
  const billDate = bill.photoTakenAt ?? new Date(bill._creationTime).toISOString();
  const d = new Date(billDate);
  if (!isNaN(d.getTime())) {
    const locale = billCountry === 'US' ? 'en-US' : 'es-CO';
    lines.push(`🕐 ${d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  }
  lines.push('');
  lines.push(t.wa_groupBreakdown(groupName));
  lines.push('');
  for (const m of members) {
    lines.push(t.wa_groupMember(m.name, formatCurrency(m.amount, billCountry)));
  }
  lines.push('');
  lines.push(sep);
  lines.push(t.wa_groupTotal(formatCurrency(groupTotal, billCountry)));
  lines.push('');
  lines.push(t.wa_footer);

  return lines.join('\n');
}
