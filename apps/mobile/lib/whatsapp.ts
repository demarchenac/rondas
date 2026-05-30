import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, type Country, type TaxConfig } from '@/constants/taxes';
import { getTaxLabel } from '@/lib/billHelpers';
import { computeContactItemShare } from '@/components/bills/share/utils';
import type { Translations } from '@/lib/i18n';

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
  contacts: { items: { itemId: string; units: number }[] }[];
}

interface ContactData {
  name: string;
  items: { itemId: string; units: number }[];
  amount: number;
}

const SEP = '─────────────';

function buildHeader(bill: BillData, billCountry: Country): string[] {
  const lines: string[] = [];
  lines.push(`🧾 *${bill.name}*`);
  if (bill.location?.address) lines.push(`📍 ${bill.location.address}`);
  const billDate = bill.photoTakenAt ?? new Date(bill._creationTime).toISOString();
  const d = new Date(billDate);
  if (!isNaN(d.getTime())) {
    const locale = billCountry === 'US' ? 'en-US' : 'es-CO';
    lines.push(`🕐 ${d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  }
  return lines;
}

export function buildWhatsAppMessage(params: {
  bill: BillData;
  contact: ContactData;
  taxConfig: TaxConfig;
  decimalPlaces?: number;
  t: Translations;
}): string {
  const { bill, contact, taxConfig, decimalPlaces, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';
  const tipPercent = bill.tipPercent ?? 0;
  const translatedTax = getTaxLabel(taxConfig, t);

  if (bill.splitStrategy === 'equal' && bill.numPeople) {
    const lines = buildHeader(bill, billCountry);
    lines.push('');
    lines.push(t.wa_equalSplit(
      formatCurrency(contact.amount, billCountry, decimalPlaces),
      formatCurrency(bill.total, billCountry, decimalPlaces),
      bill.numPeople,
    ));
    lines.push('');
    lines.push(SEP);
    lines.push(t.wa_footer);
    return lines.join('\n');
  }

  const itemResults = contact.items
    .map((ref) => {
      const result = computeContactItemShare(ref, bill.items, bill.contacts);
      return result ? { ref, ...result } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const itemLines = itemResults
    .map((r) => `- ${r.name} — ${formatCurrency(r.share, billCountry, decimalPlaces)}`)
    .join('\n');

  const contactItemsTotal = itemResults.reduce((sum, r) => sum + r.share, 0);
  const contactBase = computeBase(contactItemsTotal, taxConfig);
  const contactTax = computeTax(contactItemsTotal, taxConfig);
  const contactTip = Math.round(contactBase * (tipPercent / 100));
  const contactBeforeTip = contactBase + contactTax;
  const contactTotal = contactBase + contactTax + contactTip;

  const lines = buildHeader(bill, billCountry);
  lines.push('');
  lines.push(t.wa_breakdown(contact.name));
  lines.push('');
  lines.push(itemLines);
  lines.push('');
  lines.push(`${t.wa_subtotal}: ${formatCurrency(contactBase, billCountry, decimalPlaces)}`);
  lines.push(`${translatedTax}: ${formatCurrency(contactTax, billCountry, decimalPlaces)}`);
  lines.push(SEP);
  lines.push(`${t.wa_beforeTip}: ${formatCurrency(contactBeforeTip, billCountry, decimalPlaces)}`);
  if (tipPercent > 0) {
    lines.push(`${t.wa_tip(tipPercent)}: ${formatCurrency(contactTip, billCountry, decimalPlaces)}`);
  }
  lines.push(SEP);
  lines.push(t.wa_total(formatCurrency(contactTotal, billCountry, decimalPlaces)));
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
  decimalPlaces?: number;
  t: Translations;
}): string {
  const { bill, groupName, members, groupTotal, decimalPlaces, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';

  const lines = buildHeader(bill, billCountry);
  lines.push('');
  lines.push(t.wa_groupBreakdown(groupName));
  lines.push('');
  for (const m of members) {
    lines.push(t.wa_groupMember(m.name, formatCurrency(m.amount, billCountry, decimalPlaces)));
  }
  lines.push('');
  lines.push(SEP);
  lines.push(t.wa_groupTotal(formatCurrency(groupTotal, billCountry, decimalPlaces)));
  lines.push('');
  lines.push(t.wa_footer);

  return lines.join('\n');
}
