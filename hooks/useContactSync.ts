import { useEffect } from 'react';
import * as Contacts from 'expo-contacts';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

let didSync = false;

export function useContactSync(userId: string | undefined) {
  const syncFromDevice = useMutation(api.contacts.syncFromDevice);

  useEffect(() => {
    if (!userId || didSync) return;

    (async () => {
      const { status } = await Contacts.getPermissionsAsync();
      if (status !== 'granted') return;

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      });

      const deviceContacts = data
        .filter((c) => c.phoneNumbers?.[0]?.number)
        .map((c) => ({
          phone: c.phoneNumbers![0]!.number!,
          name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || (c.name ?? ''),
          imageUri: c.image?.uri,
        }));

      if (deviceContacts.length > 0) {
        await syncFromDevice({ userId, deviceContacts });
      }

      didSync = true;
    })();
  }, [userId, syncFromDevice]);
}
