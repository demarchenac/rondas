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

export const GROUP_TINTS_BG = [
  'bg-blue-500/10',
  'bg-purple-500/10',
  'bg-teal-500/10',
  'bg-rose-500/10',
];
