import { useEffect } from 'react';
import * as Contacts from 'expo-contacts';
import * as Sentry from '@sentry/react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSettingsStore } from '@/stores/useSettingsStore';

let didSync = false;

export function useContactSync(userId: string | undefined) {
  const syncFromDevice = useMutation(api.contacts.syncFromDevice);
  const syncContacts = useSettingsStore((s) => s.syncContacts);

  useEffect(() => {
    if (!userId || !syncContacts || didSync) return;

    (async () => {
      try {
        const { status } = await Contacts.getPermissionsAsync();
        Sentry.logger.info(`[ContactSync] permission status: ${status}`);
        if (status !== 'granted') return;

        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
          sort: Contacts.SortTypes.FirstName,
        });

        const withImages = data.filter((c) => c.image?.uri).length;
        Sentry.logger.info(`[ContactSync] device contacts: ${data.length}, with images: ${withImages}`);

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

        Sentry.logger.info(`[ContactSync] contacts with phone: ${deviceContacts.length}`);

        if (deviceContacts.length > 0) {
          const result = await syncFromDevice({ userId, deviceContacts });
          Sentry.logger.info(`[ContactSync] updated: ${result.updated}`);
        }

        didSync = true;
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'contact-sync' } });
      }
    })();
  }, [userId, syncFromDevice]);
}
