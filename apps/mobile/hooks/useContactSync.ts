import { useEffect } from 'react';
import { Contact, ContactField, ContactsSortOrder, getPermissionsAsync } from 'expo-contacts';
import * as Sentry from '@sentry/react-native';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSettingsStore } from '@/stores/useSettingsStore';

let hasSynced = false;

export function useContactSync(userId: string | undefined) {
  const syncFromDevice = useMutation(api.contacts.syncFromDevice);
  const syncContacts = useSettingsStore((s) => s.syncContacts);

  useEffect(() => {
    if (!userId || !syncContacts || hasSynced) return;

    (async () => {
      try {
        const { status } = await getPermissionsAsync();
        Sentry.logger.info(`[ContactSync] permission status: ${status}`);
        if (status !== 'granted') return;

        const data = await Contact.getAllDetails(
          [ContactField.PHONES, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.IMAGE] as const,
          { sortOrder: ContactsSortOrder.GivenName },
        );

        const withImages = data.filter((contact) => contact.image).length;
        Sentry.logger.info(`[ContactSync] device contacts: ${data.length}, with images: ${withImages}`);

        const deviceContacts = data
          .filter((contact) => contact.phones?.[0]?.number)
          .map((contact) => {
            const entry: { phone: string; name: string; imageUri?: string } = {
              phone: contact.phones![0]!.number!,
              name: `${contact.givenName ?? ''} ${contact.familyName ?? ''}`.trim() || '',
            };
            if (contact.image) entry.imageUri = contact.image;
            return entry;
          });

        Sentry.logger.info(`[ContactSync] contacts with phone: ${deviceContacts.length}`);

        if (deviceContacts.length > 0) {
          const result = await syncFromDevice({ deviceContacts });
          Sentry.logger.info(`[ContactSync] updated: ${result.updated}`);
        }

        hasSynced = true;
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'contact-sync' } });
      }
    })();
  }, [userId, syncFromDevice]);
}
