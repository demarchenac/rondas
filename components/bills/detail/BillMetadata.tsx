import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCategoryLabel } from '@/lib/billHelpers';
import { relativeTime } from '@/lib/date';
import type { Translations } from '@/lib/i18n';

interface BillMetadataProps {
  category?: string;
  location?: { address?: string };
  photoTakenAt?: string;
  creationTime: number;
  billCountry: 'CO' | 'US';
  iconColors: Record<string, string>;
  t: Translations;
  onCountryPress: () => void;
}

function BillMetadata({
  category,
  location,
  photoTakenAt,
  creationTime,
  billCountry,
  iconColors,
  t,
  onCountryPress,
}: BillMetadataProps) {
  const hasLocation = !!location?.address;
  const hasTime = !!photoTakenAt || !!creationTime;
  const hasAnyMeta = !!category || hasLocation || hasTime;

  if (!hasAnyMeta) {
    // Country-only row
    return (
      <Pressable onPress={onCountryPress} className="mx-7 mb-3 flex-row items-center gap-1.5 active:opacity-80">
        <Text className="text-xs">{billCountry === 'CO' ? '🇨🇴' : '🇺🇸'}</Text>
        <Text className="text-xs text-muted-foreground">
          {billCountry === 'CO' ? t.settings_countryColombia : t.settings_countryUSA}
        </Text>
        <IconSymbol name="chevron.right" size={10} color={iconColors.mutedLight} />
      </Pressable>
    );
  }

  const timeText = (() => {
    const photoTime = photoTakenAt ? relativeTime(photoTakenAt, t) : null;
    const billTime = relativeTime(creationTime, t) ?? 'unknown';
    if (photoTime && photoTime === billTime) return t.time_photoAndBill(billTime);
    if (photoTime) return t.time_photoBill(photoTime, billTime);
    return t.time_created(billTime);
  })();

  return (
    <View className="mx-7 mb-3 rounded-xl bg-card/50 px-4 py-2.5">
      {/* Row 1: Category · Location */}
      {(category || hasLocation) && (
        <View className="flex-row items-center gap-1.5">
          {category && (
            <>
              <IconSymbol name="fork.knife" size={11} color={iconColors.mutedLight} />
              <Text className="text-xs text-muted-foreground">{getCategoryLabel(category, t)}</Text>
            </>
          )}
          {category && hasLocation && (
            <Text className="text-xs text-muted-foreground/50">·</Text>
          )}
          {hasLocation && (
            <>
              <IconSymbol name="mappin" size={11} color={iconColors.mutedLight} />
              <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                {location!.address}
              </Text>
            </>
          )}
        </View>
      )}
      {/* Row 2: Time · Country */}
      <View className="mt-1 flex-row items-center gap-1.5">
        {hasTime && (
          <>
            <IconSymbol name="clock" size={11} color={iconColors.mutedLight} />
            <Text className="text-xs text-muted-foreground">{timeText}</Text>
            <Text className="text-xs text-muted-foreground/50">·</Text>
          </>
        )}
        <Pressable onPress={onCountryPress} className="flex-row items-center gap-1 active:opacity-80">
          <Text className="text-xs">{billCountry === 'CO' ? '🇨🇴' : '🇺🇸'}</Text>
          <Text className="text-xs text-muted-foreground">
            {billCountry === 'CO' ? t.settings_countryColombia : t.settings_countryUSA}
          </Text>
          <IconSymbol name="chevron.right" size={10} color={iconColors.mutedLight} />
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(BillMetadata);
