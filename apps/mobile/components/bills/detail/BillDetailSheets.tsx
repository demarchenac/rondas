import React from 'react';
import type { Id , Doc } from '@convex/_generated/dataModel';
import type { IconPalette } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';
import type { PhoneContactDetails } from '@/hooks/usePhoneContacts';

import ContactPickerSheet from '@/components/bills/ContactPickerSheet';
import UnassignPickerSheet from '@/components/bills/UnassignPickerSheet';
import ContactUnitSheet from '@/components/bills/detail/ContactUnitSheet';
import TipDialog from '@/components/bills/TipDialog';
import CountryDialog from '@/components/bills/CountryDialog';
import type { TaxConfig } from '@/constants/taxes';

type DialogType = 'tip' | 'country' | 'share' | 'contactPicker' | 'unassignPicker' | null;

interface ResolvedContact {
  contactId: Id<'contacts'>;
  name: string;
  phone?: string;
  imageUri?: string;
  isSelf?: boolean;
  paid: boolean;
  items: { itemId: string; units: number }[];
  amount: number;
}

interface BillDetailSheetsProps {
  activeDialog: DialogType;
  bill: {
    contacts: ResolvedContact[];
    items: { id?: string; name: string; quantity: number; unitPrice: number; subtotal: number }[];
    tip?: number;
  };
  userId: string;
  phoneContacts: PhoneContactDetails[];
  suggestedContacts?: { frequent: Doc<'contacts'>[]; recent: Doc<'contacts'>[] };
  selfContact: Doc<'contacts'> | null | undefined;
  selectedContactIds: Set<string>;
  selectedItemIds: Set<string>;
  excludePhones: Set<string> | undefined;
  excludeSelf: boolean;
  equalSplitMode: boolean;
  numPeople: number;
  unitSheetTarget: { itemId: string; contactId: Id<'contacts'> } | null;
  billCountry: 'CO' | 'US';
  decimalPlaces?: number;
  tipPercent: number;
  shouldUseCustomTip: boolean;
  base: number;
  taxConfig: TaxConfig;
  bottomInset: number;
  iconColors: IconPalette;
  t: Translations;
  onToggleContact: (contactId: string) => void;
  onConfirmContactPicker: () => void;
  onConfirmEqualContactPicker: () => void;
  onCloseContactPicker: () => void;
  onConfirmUnassign: () => void;
  onCloseUnassign: () => void;
  onUpdateUnits: (units: number) => void;
  onRemoveFromUnitSheet: () => void;
  onCloseUnitSheet: () => void;
  onSelectTip: (pct: number, newTip: number) => void;
  onSelectCustomTip: (tip: number) => void;
  onToggleCustomTip: (enabled: boolean) => void;
  onCloseDialog: () => void;
  onSelectCountry: (code: string) => void;
}

function BillDetailSheets({
  activeDialog,
  bill,
  userId,
  phoneContacts,
  suggestedContacts,
  selfContact,
  selectedContactIds,
  selectedItemIds,
  excludePhones,
  excludeSelf,
  equalSplitMode,
  numPeople,
  unitSheetTarget,
  billCountry,
  decimalPlaces,
  tipPercent,
  shouldUseCustomTip,
  base,
  taxConfig,
  bottomInset,
  iconColors,
  t,
  onToggleContact,
  onConfirmContactPicker,
  onConfirmEqualContactPicker,
  onCloseContactPicker,
  onConfirmUnassign,
  onCloseUnassign,
  onUpdateUnits,
  onRemoveFromUnitSheet,
  onCloseUnitSheet,
  onSelectTip,
  onSelectCustomTip,
  onToggleCustomTip,
  onCloseDialog,
  onSelectCountry,
}: BillDetailSheetsProps) {
  const unitTarget = unitSheetTarget && bill ? (() => {
    const targetItem = bill.items.find((item) => item.id === unitSheetTarget.itemId);
    const targetContact = bill.contacts.find((contact) => contact.contactId === unitSheetTarget.contactId);
    if (!targetItem || !targetContact) return null;
    const ref = targetContact.items.find((itemRef) => itemRef.itemId === unitSheetTarget.itemId);
    if (!ref) return null;
    return { targetItem, targetContact, ref };
  })() : null;

  return (
    <>
      <ContactPickerSheet
        visible={activeDialog === 'contactPicker'}
        phoneContacts={phoneContacts}
        suggestedContacts={suggestedContacts}
        selfContact={selfContact}
        billContacts={bill.contacts.filter((c) => !c.isSelf).map((c) => ({ _id: c.contactId, _creationTime: 0, userId, name: c.name, phone: c.phone, imageUri: c.imageUri, referenceCount: 0, lastReferencedAt: 0 }))}
        selectedContactIds={selectedContactIds}
        excludePhones={excludePhones}
        excludeSelf={excludeSelf}
        maxSelectable={equalSplitMode ? numPeople - bill.contacts.length : undefined}
        bottomInset={bottomInset}
        onToggleContact={onToggleContact}
        onConfirm={equalSplitMode ? onConfirmEqualContactPicker : onConfirmContactPicker}
        onClose={onCloseContactPicker}
      />

      <UnassignPickerSheet
        visible={activeDialog === 'unassignPicker'}
        contacts={bill.contacts}
        selectedItemIds={selectedItemIds}
        selectedContactIds={selectedContactIds}
        bottomInset={bottomInset}
        onToggleContact={onToggleContact}
        onConfirm={onConfirmUnassign}
        onClose={onCloseUnassign}
      />

      {unitTarget && (
        <ContactUnitSheet
          visible
          contactName={unitTarget.targetContact.name}
          contactImageUri={unitTarget.targetContact.imageUri}
          contactId={unitTarget.targetContact.contactId}
          isSelf={unitTarget.targetContact.isSelf}
          itemName={unitTarget.targetItem.name}
          itemQuantity={unitTarget.targetItem.quantity}
          unitPrice={unitTarget.targetItem.unitPrice}
          currentUnits={unitTarget.ref.units}
          maxUnits={99}
          billCountry={billCountry}
          bottomInset={bottomInset}
          onUpdateUnits={onUpdateUnits}
          onRemove={onRemoveFromUnitSheet}
          onClose={onCloseUnitSheet}
        />
      )}

      <TipDialog
        visible={activeDialog === 'tip'}
        tipPercent={tipPercent}
        shouldUseCustomTip={shouldUseCustomTip}
        customTip={bill.tip ?? 0}
        subtotal={base}
        billCountry={billCountry}
        decimalPlaces={decimalPlaces}
        iconColors={iconColors}
        onSelectTip={onSelectTip}
        onSelectCustomTip={onSelectCustomTip}
        onToggleCustomTip={onToggleCustomTip}
        onClose={onCloseDialog}
      />

      <CountryDialog
        visible={activeDialog === 'country'}
        billCountry={billCountry}
        onSelectCountry={onSelectCountry}
        onClose={onCloseDialog}
      />
    </>
  );
}

export default React.memo(BillDetailSheets);
