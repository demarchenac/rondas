import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { useT } from '@/lib/i18n';

function getScanStatusLabel(
  status: string | undefined,
  t: ReturnType<typeof useT>,
  itemCount: number,
): { title: string; hint: string } {
  switch (status) {
    case 'thinking':
      return { title: t.scan_reading, hint: t.scan_readingHint };
    case 'extracting':
      return { title: t.scan_extracting, hint: t.scan_itemsFound(itemCount) };
    default:
      return { title: t.scan_analyzing, hint: t.scan_analyzeHint };
  }
}

interface ScanProgressData {
  status?: string;
  result?: {
    items?: { name: string; subtotal: number }[];
  } | null;
}

interface ScanningOverlayProps {
  scanProgress: ScanProgressData | null | undefined;
  billCountry: string;
  t: ReturnType<typeof useT>;
}

function ScanningOverlay({ scanProgress, billCountry, t }: ScanningOverlayProps) {
  const { title, hint } = getScanStatusLabel(
    scanProgress?.status,
    t,
    scanProgress?.result?.items?.length ?? 0,
  );

  return (
    <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
      <BlurView
        intensity={30}
        tint="dark"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(18,26,46,0.7)',
        }}
      />
      <View className="z-[1] w-full items-center px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
        <Text className="mt-5 text-[17px] font-bold text-foreground">
          {title}
        </Text>
        <Text className="mt-1.5 text-[13px] text-muted-foreground">
          {hint}
        </Text>
        {/* Stream items as they arrive */}
        {scanProgress?.result?.items && scanProgress.result.items.length > 0 && (
          <View className="mt-5 max-h-[200px] w-full">
            {scanProgress.result.items.map((item, i) => (
              <View
                key={i}
                className={cn(
                  'flex-row justify-between py-1.5',
                  i < (scanProgress.result?.items?.length ?? 0) - 1 && 'border-b border-white/[0.08]',
                )}
              >
                <Text className="flex-1 text-[13px] text-foreground" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="ml-3 text-[13px] font-semibold text-primary">
                  {formatCurrency(item.subtotal, billCountry)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default React.memo(ScanningOverlay);
