import React from 'react';
import { Modal, Platform, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/format';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/cn';
import type { Id } from '@/convex/_generated/dataModel';

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
  itemQuantity,
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

  const showStepper = itemQuantity > 1;
  const contactTotal = currentUnits * unitPrice;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background pt-3" style={{ paddingBottom: bottomInset, ...(Platform.OS === 'android' && { paddingTop: insets.top }) }}>
        <View className="items-center pb-2">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>
        <View className="flex-row items-center justify-between px-7 pb-3 pt-2">
          <View className="flex-row items-center gap-3">
            {contactImageUri ? (
              <Image source={{ uri: contactImageUri }} className="w-10 h-10 rounded-full" />
            ) : (
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
                <Text className="text-base font-bold text-primary">
                  {(contactName[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="text-xl font-bold text-foreground">
              {isSelf ? t.self_label(contactName) : contactName}
            </Text>
          </View>
          <Pressable onPress={onClose} className="rounded-full bg-muted p-2">
            <IconSymbol name="xmark" size={14} color={iconColors.muted} />
          </Pressable>
        </View>

        <View className="flex-1 px-7 pt-4">
          <View className="rounded-2xl bg-card p-5">
            <Text className="text-sm font-medium text-muted-foreground">{itemName}</Text>
            <Text className="mt-1 text-xs text-muted-foreground/60">
              {t.scan_unitPrice}: {formatCurrency(unitPrice, billCountry)}
            </Text>

            {showStepper && (
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
                    <IconSymbol
                      name="minus"
                      size={18}
                      color={currentUnits <= 1 ? iconColors.mutedLight : iconColors.primary}
                    />
                  </Pressable>

                  <Text className="min-w-[40px] text-center text-3xl font-bold tabular-nums text-foreground">
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
                    <IconSymbol
                      name="plus"
                      size={18}
                      color={currentUnits >= maxUnits ? iconColors.mutedLight : iconColors.primary}
                    />
                  </Pressable>
                </View>
              </View>
            )}

            <View className="mt-5 items-center rounded-xl bg-primary/5 py-3">
              <Text className="text-sm text-muted-foreground">Total</Text>
              <Text className="text-2xl font-bold text-foreground">
                {formatCurrency(contactTotal, billCountry)}
              </Text>
              {showStepper && currentUnits > 1 && (
                <Text className="text-xs text-muted-foreground/60">
                  {currentUnits} × {formatCurrency(unitPrice, billCountry)}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={onRemove}
            className="mt-4 items-center rounded-xl border border-destructive/30 bg-destructive/15 py-4"
          >
            <Text className="text-base font-semibold text-destructive">{t.bill_removeContact}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(ContactUnitSheet);
