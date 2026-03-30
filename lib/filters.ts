import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { BillState } from '@/lib/billHelpers';

/** Contact reference as stored in bills (schema) + resolved fields from contacts table (query join) */
export interface ResolvedContact {
  contactId: Id<'contacts'>;
  items: string[];
  amount: number;
  paid: boolean;
  // Resolved from contacts table by query join
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
}

/** Bill with contacts resolved to include name/phone/imageUri from contacts table */
export type ResolvedBill = Omit<Doc<'bills'>, 'contacts'> & {
  contacts: ResolvedContact[];
};

// --- Filter types ---

export type DatePreset = '1h' | '1d' | '7d' | '30d' | 'custom';

export interface FilterState {
  country: string;
  state: BillState | 'all';
  contactIds: Id<'contacts'>[];
  minAmount: number | null;
  maxAmount: number | null;
  datePreset: DatePreset;
  fromDate: number | null;
  toDate: number | null;
}

const DATE_PRESET_OFFSETS: Record<Exclude<DatePreset, 'custom'>, number> = {
  '1h': 3_600_000,
  '1d': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

export function defaultFilters(userCountry: string): FilterState {
  return {
    country: userCountry,
    state: 'all',
    contactIds: [],
    minAmount: null,
    maxAmount: null,
    datePreset: '7d',
    fromDate: Date.now() - DATE_PRESET_OFFSETS['7d'],
    toDate: null,
  };
}

export function computeFromDate(preset: DatePreset, customFrom: number | null): number | null {
  if (preset === 'custom') return customFrom;
  return Date.now() - DATE_PRESET_OFFSETS[preset];
}
