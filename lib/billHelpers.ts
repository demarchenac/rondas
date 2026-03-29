import type { Translations } from '@/lib/i18n';
import type { TaxConfig } from '@/constants/taxes';

export type BillState = 'draft' | 'unsplit' | 'split' | 'unresolved';

export const STATE_STYLES: Record<BillState, { dot: string; bg: string; text: string; color: string; dotClass: string; bgClass: string; textClass: string; borderClass: string; progressClass: string }> = {
  draft: { dot: '#6366f1', bg: 'rgba(99,102,241,0.15)', text: '#6366f1', color: '#6366f1', dotClass: 'bg-indigo-500', bgClass: 'bg-indigo-500/15', textClass: 'text-indigo-500', borderClass: 'border-l-indigo-500', progressClass: 'bg-indigo-500' },
  unsplit: { dot: '#94a3b8', bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', color: '#94a3b8', dotClass: 'bg-slate-400', bgClass: 'bg-slate-400/15', textClass: 'text-slate-400', borderClass: 'border-l-slate-400', progressClass: 'bg-slate-400' },
  split: { dot: '#10b981', bg: 'rgba(16,185,129,0.15)', text: '#10b981', color: '#10b981', dotClass: 'bg-emerald-500', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-500', borderClass: 'border-l-emerald-500', progressClass: 'bg-emerald-500' },
  unresolved: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', color: '#f59e0b', dotClass: 'bg-amber-500', bgClass: 'bg-amber-500/15', textClass: 'text-amber-500', borderClass: 'border-l-amber-500', progressClass: 'bg-amber-500' },
};

export const STATE_LABEL_KEYS: Record<BillState, keyof Translations> = {
  draft: 'state_draft',
  unsplit: 'state_unsplit',
  split: 'state_split',
  unresolved: 'state_unresolved',
};

export function stateLabel(t: Translations, state: BillState): string {
  const map: Record<BillState, string> = {
    draft: t.state_draft,
    unsplit: t.state_unsplit,
    split: t.state_split,
    unresolved: t.state_unresolved,
  };
  return map[state];
}

const TAX_LABEL_MAP: Record<string, keyof Translations> = {
  'Impoconsumo (included)': 'tax_impoconsumo',
  'IVA (included)': 'tax_iva',
  'Sales Tax': 'tax_salesTax',
};

const CATEGORY_KEY_MAP: Record<string, keyof Translations> = {
  dining: 'category_dining',
  retail: 'category_retail',
  service: 'category_service',
};

export function getTaxLabel(taxConfig: TaxConfig, t: Translations): string {
  const key = TAX_LABEL_MAP[taxConfig.taxLabel];
  return key ? (t[key] as string) : taxConfig.taxLabel;
}

export function getCategoryLabel(category: string, t: Translations): string {
  const key = CATEGORY_KEY_MAP[category];
  return key ? (t[key] as string) : category;
}
