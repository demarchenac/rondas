import React, { useCallback, useEffect, useRef } from 'react';
import { View, Pressable } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/format';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/cn';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Id } from '@convex/_generated/dataModel';

interface ContactUnitSheetProps {
  visible: boolean;
  contactName: string;
  contactImageUri?: string;
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  itemName: string;
  itemQuantity: number;
  unitPrice: number;
  currentUnits: number;
  maxUnits: number;
  billCountry: string;
  bottomInset: number;
  onUpdateUnits: (units: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

function ContactUnitSheet({
  visible,
  contactName,
  contactImageUri,
  isSelf,
  itemName,
  unitPrice,
  currentUnits,
  maxUnits,
  billCountry,
  bottomInset,
  onUpdateUnits,
  onRemove,
  onClose,
}: ContactUnitSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);


  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  const contactTotal = currentUnits * unitPrice;

  return (
    <TrueSheet
      ref={sheetRef}
      name="contact-unit"
      detents={['auto']}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ paddingBottom: bottomInset > 0 ? bottomInset : 16 }}>
        {/* Contact header */}
        <View className="flex-row items-center gap-3 px-6 pt-4 pb-4">
          {contactImageUri ? (
            <Image source={{ uri: contactImageUri }} className="w-10 h-10 rounded-full" />
          ) : (
            <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
              <Text className="text-lg font-bold text-primary">
                {(contactName[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-2xl font-bold text-foreground">
            {isSelf ? t.self_label(contactName) : contactName}
          </Text>
        </View>

        {/* Item + stepper */}
        <View className="mx-6 rounded-2xl bg-card p-5">
          <Text className="text-base font-medium text-muted-foreground">{itemName}</Text>
          <Text className="mt-1 text-sm text-muted-foreground/60">
            {t.scan_unitPrice}: {formatCurrency(unitPrice, billCountry)}
          </Text>

          <View className="mt-6 items-center">
            <View className="flex-row items-center gap-5">
              <Pressable
                onPress={() => currentUnits > 1 && onUpdateUnits(currentUnits - 1)}
                disabled={currentUnits <= 1}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-full border',
                  currentUnits <= 1
                    ? 'border-muted-foreground/20 bg-muted/50'
                    : 'border-primary/30 bg-primary/10 active:bg-primary/20',
                )}
              >
                <IconSymbol name="minus" size={18} color={currentUnits <= 1 ? iconColors.mutedLight : iconColors.primary} />
              </Pressable>

              <Text className="min-w-[40px] text-center text-4xl font-bold tabular-nums text-foreground">
                {currentUnits}
              </Text>

              <Pressable
                onPress={() => currentUnits < maxUnits && onUpdateUnits(currentUnits + 1)}
                disabled={currentUnits >= maxUnits}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-full border',
                  currentUnits >= maxUnits
                    ? 'border-muted-foreground/20 bg-muted/50'
                    : 'border-primary/30 bg-primary/10 active:bg-primary/20',
                )}
              >
                <IconSymbol name="plus" size={18} color={currentUnits >= maxUnits ? iconColors.mutedLight : iconColors.primary} />
              </Pressable>
            </View>
          </View>

          <View className="mt-5 items-center rounded-xl bg-primary/5 py-3">
            <Text className="text-base text-muted-foreground">Total</Text>
            <Text className="text-3xl font-bold text-foreground">
              {formatCurrency(contactTotal, billCountry)}
            </Text>
            {currentUnits > 1 && (
              <Text className="text-sm text-muted-foreground/60">
                {currentUnits} × {formatCurrency(unitPrice, billCountry)}
              </Text>
            )}
          </View>
        </View>

        {/* Remove button */}
        <View className="px-6 pt-3">
          <Pressable onPress={onRemove} className="items-center rounded-2xl bg-destructive/10 py-4 active:opacity-80">
            <Text className="text-lg font-semibold text-destructive">{t.bill_removeContact}</Text>
          </Pressable>
        </View>
      </View>
    </TrueSheet>
  );
}

export default React.memo(ContactUnitSheet);
