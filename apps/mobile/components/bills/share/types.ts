export type { ResolvedContact } from '@/lib/types';

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
