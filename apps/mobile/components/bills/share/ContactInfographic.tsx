import React from 'react';
import { View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import BillInfographic from '@/components/bills/BillInfographic';
import type { TaxConfig } from '@/constants/taxes';
import type { Translations } from '@/lib/i18n';
import type { ResolvedContact, ContactShareData } from './types';

interface ContactInfographicProps {
  viewShotRef: (r: ViewShotRef | null) => void;
  contact: ResolvedContact;
  shareData: ContactShareData;
  billName: string;
  taxConfig: TaxConfig;
  tipPercent: number;
  location?: string;
  date: string;
  country: 'CO' | 'US';
  t: Translations;
}

function ContactInfographic({ viewShotRef, contact, shareData, billName, taxConfig, tipPercent, location, date, country, t }: ContactInfographicProps) {
  return (
    <View style={{ position: 'absolute', left: -9999 }}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <BillInfographic
          billName={billName}
          contactName={contact.isSelf ? t.self_label(contact.name) : contact.name}
          contactImageUri={contact.imageUri}
          items={contact.items.map((itemRef) => {
            const info = shareData.items.get(itemRef.itemId);
            return { name: info?.name ?? '', amount: info?.share ?? 0, units: itemRef.units, totalUnits: info?.totalUnits ?? 0 };
          })}
          taxConfig={taxConfig}
          tipPercent={tipPercent}
          location={location}
          date={date}
          country={country}
          t={t}
        />
      </ViewShot>
    </View>
  );
}

export default React.memo(ContactInfographic);
