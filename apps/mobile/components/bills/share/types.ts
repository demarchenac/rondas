import type { Id } from '@convex/_generated/dataModel';

export interface ResolvedContact {
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  name: string;
  phone?: string;
  imageUri?: string;
  items: { itemId: string; units: number }[];
  amount: number;
  paid: boolean;
}

export interface ItemShareInfo {
  share: number;
  totalUnits: number;
  name: string;
}

export interface ContactShareData {
  items: Map<string, ItemShareInfo>;
  total: number;
  tax: number;
  tip: number;
}
