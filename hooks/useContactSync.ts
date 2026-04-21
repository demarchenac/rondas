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
        .map((c) => {
          const entry: { phone: string; name: string; imageUri?: string } = {
            phone: c.phoneNumbers![0]!.number!,
            name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || (c.name ?? ''),
          };
          if (c.image?.uri) entry.imageUri = c.image.uri;
          return entry;
        });

      if (deviceContacts.length > 0) {
        const result = await syncFromDevice({ userId, deviceContacts });
        if (__DEV__) console.log(`[ContactSync] ${deviceContacts.length} device contacts, ${result.updated} updated`);
      }

      didSync = true;
    })();
  }, [userId, syncFromDevice]);
}
