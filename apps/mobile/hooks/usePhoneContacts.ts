import { useCallback, useRef, useState } from 'react';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync, type PartialContactDetails } from 'expo-contacts';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { useT } from '@/lib/i18n';

const CONTACTS_CACHE_TTL = 5 * 60_000;
const DETAIL_FIELDS = [ContactField.PHONES, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.IMAGE] as const;

export type PhoneContactDetails = PartialContactDetails<typeof DETAIL_FIELDS> & { id: string };

export function usePhoneContacts() {
  const t = useT();
  const { alert } = useCustomAlert();
  const [phoneContacts, setPhoneContacts] = useState<PhoneContactDetails[]>([]);
  const contactsCacheRef = useRef<{ data: PhoneContactDetails[]; fetchedAt: number } | null>(null);
  const contactsPermissionRef = useRef(false);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (contactsPermissionRef.current) return true;
    const { status } = await requestPermissionsAsync();
    if (status !== 'granted') {
      alert(t.bill_permissionNeeded, t.bill_permissionContacts);
      return false;
    }
    contactsPermissionRef.current = true;
    return true;
  }, [t, alert]);

  const loadContacts = useCallback(async () => {
    const cache = contactsCacheRef.current;
    if (cache && Date.now() - cache.fetchedAt < CONTACTS_CACHE_TTL) {
      setPhoneContacts(cache.data);
      return;
    }

    const quickFields = [ContactField.PHONES, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME] as const;
    const quickData = await Contact.getAllDetails(quickFields, { sortOrder: ContactsSortOrder.GivenName });
    const filtered = quickData.map((c) => ({ ...c, id: c.id! })).filter((c) => !!c.id) as PhoneContactDetails[];
    setPhoneContacts(filtered);
    contactsCacheRef.current = { data: filtered, fetchedAt: Date.now() };

    const fullData = await Contact.getAllDetails(DETAIL_FIELDS, { sortOrder: ContactsSortOrder.GivenName });
    const enriched = fullData.map((c) => ({ ...c, id: c.id! })).filter((c) => !!c.id) as PhoneContactDetails[];
    setPhoneContacts(enriched);
    contactsCacheRef.current = { data: enriched, fetchedAt: Date.now() };
  }, []);

  return { phoneContacts, ensurePermission, loadContacts };
}
