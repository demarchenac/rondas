import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, type Country, type TaxConfig } from '@/constants/taxes';
import { getTaxLabel } from '@/lib/billHelpers';
import { computeContactItemShare } from '@/lib/billSplit';
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
  items: { id?: string; name: string; quantity: number; subtotal: number }[];
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
  const parsedDate = new Date(billDate);
  if (!isNaN(parsedDate.getTime())) {
    const locale = billCountry === 'US' ? 'en-US' : 'es-CO';
    lines.push(`🕐 ${parsedDate.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`);
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
    .filter((result): result is NonNullable<typeof result> => result != null);

  const itemLines = itemResults
    .map((result) => `- ${result.name} — ${formatCurrency(result.share, billCountry, decimalPlaces)}`)
    .join('\n');

  const contactItemsTotal = itemResults.reduce((sharesTotal, result) => sharesTotal + result.share, 0);
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

export function buildBillWhatsAppMessage(params: {
  bill: BillData;
  contacts: { name: string; amount: number; paid: boolean }[];
  billTotal: number;
  decimalPlaces?: number;
  t: Translations;
}): string {
  const { bill, contacts, billTotal, decimalPlaces, t } = params;
  const billCountry: Country = (bill.country as Country) || 'CO';

  const lines = buildHeader(bill, billCountry);
  lines.push('');
  lines.push(t.wa_billSummary);
  lines.push('');
  for (const contact of contacts) {
    lines.push(t.wa_billMember(contact.name, formatCurrency(contact.amount, billCountry, decimalPlaces), contact.paid));
  }
  lines.push('');
  lines.push(SEP);
  lines.push(t.wa_total(formatCurrency(billTotal, billCountry, decimalPlaces)));
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
  for (const member of members) {
    lines.push(t.wa_groupMember(member.name, formatCurrency(member.amount, billCountry, decimalPlaces)));
  }
  lines.push('');
  lines.push(SEP);
  lines.push(t.wa_groupTotal(formatCurrency(groupTotal, billCountry, decimalPlaces)));
  lines.push('');
  lines.push(t.wa_footer);

  return lines.join('\n');
}
