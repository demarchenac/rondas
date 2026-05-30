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

export function buildGroupName(members: { isSelf?: boolean; name: string }[], selfLabel: (name: string) => string): string {
  const names = members.map((m) => m.isSelf ? selfLabel(m.name) : m.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export const GROUP_TINTS_BG = [
  'bg-blue-500/10',
  'bg-purple-500/10',
  'bg-teal-500/10',
  'bg-rose-500/10',
];
