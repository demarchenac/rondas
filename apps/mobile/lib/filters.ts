import type { Doc, Id } from '@convex/_generated/dataModel';
import type { BillState } from '@/lib/billHelpers';

/** Contact reference as stored in bills (schema) + resolved fields from contacts table (query join) */
export interface ResolvedContact {
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  items: { itemId: string; units: number }[];
  amount: number;
  paid: boolean;
  // Resolved from contacts table by query join
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
}

export interface ResolvedTag {
  _id: Id<'tags'>;
  name: string;
  slug?: string;
  color: string;
  isPlatform: boolean;
  sortOrder: number;
}

/** Bill with contacts and tags resolved from their respective tables */
export type ResolvedBill = Omit<Doc<'bills'>, 'contacts'> & {
  contacts: ResolvedContact[];
  tags?: ResolvedTag[];
};

// --- Filter types ---

export type DatePreset = '1h' | '1d' | '7d' | '30d' | 'custom';
export type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'updated' | 'name_asc';

export interface FilterState {
  country: string;
  state: BillState | 'all';
  contactIds: Id<'contacts'>[];
  minAmount: number | null;
  maxAmount: number | null;
  datePreset: DatePreset;
  fromDate: number | null;
  toDate: number | null;
  sort: SortOption;
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
    sort: 'newest',
  };
}

export function sortBills(bills: ResolvedBill[], sort: SortOption): ResolvedBill[] {
  return [...bills].sort((a, b) => {
    switch (sort) {
      case 'newest': return b._creationTime - a._creationTime;
      case 'oldest': return a._creationTime - b._creationTime;
      case 'highest': return b.total - a.total;
      case 'lowest': return a.total - b.total;
      case 'updated': return (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime);
      case 'name_asc': return a.name.localeCompare(b.name);
    }
  });
}

export function computeFromDate(preset: DatePreset, customFrom: number | null): number | null {
  if (preset === 'custom') return customFrom;
  return Date.now() - DATE_PRESET_OFFSETS[preset];
}
