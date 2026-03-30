import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, getTaxConfig, type Country, type ReceiptCategory } from '@/constants/taxes';
import { getTaxLabel } from '@/lib/billHelpers';
import type { Translations } from '@/lib/i18n';

interface BillData {
  name: string;
  category?: string;
  country?: string;
  tipPercent?: number;
  location?: { address?: string };
  photoTakenAt?: string;
  _creationTime: number;
  items: { id?: string; name: string; subtotal: number }[];
  contacts: { items: string[] }[];
}

interface ContactData {
  name: string;
  items: string[];
  amount: number;
}

export function buildWhatsAppMessage(params: {
  bill: BillData;
  contact: ContactData;
  t: Translations;
}): string {
  const { bill, contact, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';
  const billCategory: ReceiptCategory = (bill.category as ReceiptCategory) || 'dining';
  const taxConfig = getTaxConfig(billCountry, billCategory);
  const tipPercent = bill.tipPercent ?? 0;
  const translatedTax = getTaxLabel(taxConfig, t);
  const sep = '─────────────';

  // Per-contact item shares
  const itemLines = contact.items
    .map((itemId) => {
      const item = bill.items.find((billItem) => billItem.id === itemId);
      if (!item) return null;
      const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
      const share = Math.round(item.subtotal / numContacts);
      return `- ${item.name} — ${formatCurrency(share, billCountry)}`;
    })
    .filter(Boolean)
    .join('\n');

  // Per-contact totals
  const contactItemsTotal = contact.items.reduce((sum, itemId) => {
    const item = bill.items.find((billItem) => billItem.id === itemId);
    if (!item) return sum;
    const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
    return sum + Math.round(item.subtotal / numContacts);
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
