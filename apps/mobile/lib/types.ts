import type { Id } from '@convex/_generated/dataModel';

export interface ContactItemRef {
  itemId: string;
  units: number;
}

export interface BillItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ResolvedContact {
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
  items: ContactItemRef[];
  amount: number;
  paid: boolean;
}

export interface ContactGroup {
  id: string;
  contactIds: Id<'contacts'>[];
  name: string;
}

export type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';

export type DialogType = 'tip' | 'country' | 'share' | 'contactPicker' | 'unassignPicker' | null;

export type ScanPhase = 'uploading' | 'analyzing' | 'thinking' | 'extracting' | 'complete';

export type ScanErrorType = 'timeout' | 'api' | 'not_a_receipt' | 'generic';

export interface ScanError {
  type: ScanErrorType;
  message: string;
  hint: string;
}
