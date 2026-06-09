import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { IconPalette } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';
import ScanningOverlay from '@/components/bills/ScanningOverlay';
import type { ScanError, ScanPhase } from '@/lib/types';

interface ScanPreviewProps {
  imageUri: string;
  isScanning: boolean;
  error: ScanError | null;
  scanAttempts: number;
  scanProgress: React.ComponentProps<typeof ScanningOverlay>['scanProgress'];
  localPhase: ScanPhase;
  billCountry: string;
  bottomInset: number;
  iconColors: IconPalette;
  t: Translations;
  onScan: () => void;
  onRetry: () => void;
  onGoBack: () => void;
  onManualEntry: () => void;
  onManualEntryFromError: () => void;
}

function ScanPreview({
  imageUri,
  isScanning,
  error,
  scanAttempts,
  scanProgress,
  localPhase,
  billCountry,
  bottomInset,
  iconColors,
  t,
  onScan,
  onRetry,
  onGoBack,
  onManualEntry,
  onManualEntryFromError,
}: ScanPreviewProps) {
  return (
    <View className="flex-1 bg-background">
      <Image
        source={{ uri: imageUri }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      <View className="z-10 items-center pt-3">
        <View className="h-1 w-10 rounded-sm bg-white/50" />
      </View>

      <View className="flex-1 justify-end">
        <LinearGradient
          colors={['transparent', 'rgba(18,26,46,0.85)', 'rgba(18,26,46,0.95)']}
          locations={[0, 0.5, 1]}
          style={{ paddingBottom: bottomInset + 8, paddingHorizontal: 28, paddingTop: 100 }}
        >
          {error && (
            <View className="mb-4 overflow-hidden rounded-[14px]">
              <BlurView intensity={80} tint="dark" className="px-4 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <Pressable onPress={error.type === 'not_a_receipt' ? onGoBack : onRetry}>
                  <View className="flex-row items-center justify-center gap-2">
                    <IconSymbol
                      name={error.type === 'timeout' ? 'wifi.slash' : 'exclamationmark.triangle'}
                      size={16}
                      color={iconColors.destructive}
                    />
                    <Text className="text-base font-medium text-white">
                      {error.message}
                    </Text>
                  </View>
                  <Text className="mt-1 text-center text-sm text-white/60">
                    {error.hint}
                  </Text>
                  <Text className="mt-1.5 text-center text-sm font-semibold text-primary">
                    {error.type === 'not_a_receipt' ? t.scan_tapGoBack : t.scan_tapRetry}
                  </Text>
                </Pressable>
                {scanAttempts >= 2 && (
                  <Pressable onPress={onManualEntryFromError} className="mt-2 items-center border-t border-white/10 pt-2">
                    <Text className="text-sm font-semibold text-muted-foreground">
                      {t.scan_enterManually}
                    </Text>
                  </Pressable>
                )}
              </BlurView>
            </View>
          )}

          {!isScanning && (
            <>
              <Pressable
                onPress={onScan}
                className="overflow-hidden rounded-2xl border border-primary/30"
              >
                <BlurView
                  intensity={60}
                  tint="dark"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    paddingVertical: 16,
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  }}
                >
                  <IconSymbol name="doc.text.viewfinder" size={22} color={iconColors.primary} />
                  <Text className="text-xl font-semibold text-white">
                    {t.scan_scanBill}
                  </Text>
                </BlurView>
              </Pressable>

              <Pressable onPress={onManualEntry} className="items-center py-4">
                <Text className="text-base font-medium text-muted-foreground">
                  {t.scan_enterManually}
                </Text>
              </Pressable>
            </>
          )}
        </LinearGradient>
      </View>

      {isScanning && (
        <ScanningOverlay scanProgress={scanProgress} localPhase={localPhase} billCountry={billCountry} />
      )}
    </View>
  );
}

export default React.memo(ScanPreview);
