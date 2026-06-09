import type { PhoneContactDetails } from '@/hooks/usePhoneContacts';
import { SUGGESTED_PREFIX, SELF_PREFIX, ANON_PREFIX } from '@/components/bills/ContactPickerSheet';

interface SuggestedContact {
  _id: string;
  name: string;
  phone?: string;
  imageUri?: string;
}

interface SelfContact {
  name: string;
  imageUri?: string;
}

interface ContactInfo {
  name: string;
  phone?: string;
  imageUri?: string;
  isSelf?: boolean;
}

export function resolveContactInfo(
  selectedId: string,
  billContacts: { phone?: string; isSelf?: boolean }[],
  phoneContacts: PhoneContactDetails[],
  allSuggested: SuggestedContact[],
  selfContact: SelfContact | null | undefined,
  anonLabel: (n: number) => string,
): ContactInfo | null {
  if (selectedId.startsWith(ANON_PREFIX)) {
    const anonNum = parseInt(selectedId.slice(ANON_PREFIX.length), 10);
    const existingAnonCount = billContacts.filter((c) => !c.phone && !c.isSelf).length;
    return { name: anonLabel(existingAnonCount + anonNum) };
  }

  if (selectedId.startsWith(SELF_PREFIX)) {
    if (!selfContact) return null;
    return { name: selfContact.name, imageUri: selfContact.imageUri, isSelf: true };
  }

  if (selectedId.startsWith(SUGGESTED_PREFIX)) {
    const convexId = selectedId.slice(SUGGESTED_PREFIX.length);
    const suggested = allSuggested.find((c) => c._id === convexId);
    if (!suggested) return null;
    return { name: suggested.name, phone: suggested.phone, imageUri: suggested.imageUri };
  }

  const contact = phoneContacts.find((c) => c.id === selectedId);
  if (!contact) return null;
  const phone = contact.phones?.[0]?.number ?? '';
  const name = `${contact.givenName ?? ''}${contact.familyName ? ` ${contact.familyName}` : ''}`.trim() || 'Unknown';
  return { name, phone, imageUri: contact.image ?? undefined };
}

export function buildContactArgs(
  billContacts: { name: string; phone?: string; isSelf?: boolean; imageUri?: string }[],
): { name: string; phone?: string; isSelf?: boolean; imageUri?: string }[] {
  return billContacts.map((c) => ({
    name: c.name,
    phone: c.phone,
    isSelf: c.isSelf || undefined,
    imageUri: c.imageUri,
  }));
}
