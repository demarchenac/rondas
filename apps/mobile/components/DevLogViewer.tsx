import React, { useCallback, useRef } from 'react';
import { Platform, Pressable, Share, View, useWindowDimensions } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useLogStore, type LogEntry, devLog } from '@/stores/useLogStore';

const LEVEL_COLORS: Record<string, string> = {
  info: '#38bdf8',
  warn: '#f59e0b',
  error: '#ef4444',
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function LogRow({ item }: { item: LogEntry }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
      <Text style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', width: 85 }}>{formatTime(item.timestamp)}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: LEVEL_COLORS[item.level] ?? '#94a3b8', width: 36 }}>{item.level.toUpperCase()}</Text>
      <Text style={{ fontSize: 11, color: '#e2e8f0', flex: 1, fontFamily: 'monospace' }} numberOfLines={3}>{item.message}</Text>
    </View>
  );
}

export default function DevLogViewer() {
  const sheetRef = useRef<TrueSheet>(null);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const logs = useLogStore((s) => s.logs);
  const clearLogs = useLogStore((s) => s.clear);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const useGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  const translateX = useSharedValue(screenW - 50);
  const translateY = useSharedValue(insets.top + 60);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const sheetRefCallback = useRef(() => { sheetRef.current?.present(); });

  const handleShare = useCallback(() => {
    const text = logs.map((l) => `[${formatTime(l.timestamp)}] ${l.level.toUpperCase()} ${l.message}`).join('\n');
    Share.share({ message: text || 'No logs' });
  }, [logs]);

  const renderItem = useCallback(({ item }: { item: LogEntry }) => <LogRow item={item} />, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = Math.max(0, Math.min(screenW - 44, offsetX.value + e.translationX));
      translateY.value = Math.max(insets.top, Math.min(screenH - 60, offsetY.value + e.translationY));
    })
    .onEnd(() => {
      isDragging.value = false;
      const snapX = translateX.value < screenW / 2 ? 6 : screenW - 50;
      translateX.value = withSpring(snapX, { damping: 20, stiffness: 200 });
    });

  // eslint-disable-next-line react-hooks/refs -- gesture callbacks run outside render
  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(sheetRefCallback.current)(); });
  const longPressGesture = Gesture.LongPress().minDuration(500).onEnd(() => { runOnJS(clearLogs)(); });

  const composed = Gesture.Race(panGesture, Gesture.Exclusive(longPressGesture, tapGesture));

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: isDragging.value ? 1 : 0.7,
  }));

  if (!devLog.enabled) return null;

  return (
    <>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }, pillStyle]}
        >
          {useGlass ? (
            <GlassView
              isInteractive
              tintColor={iconColors.primary + '1A'}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22 }}>🐛</Text>
            </GlassView>
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>🐛</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      <TrueSheet
        ref={sheetRef}
        name="dev-log-viewer"
        detents={[0.5, 1]}
        grabber
        cornerRadius={20}
        scrollable
        backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      >
        <View style={{ flex: 1, paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#f8fafc' : '#0f172a' }}>
              Debug Logs ({logs.length})
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={handleShare} style={{ padding: 4 }}>
                <IconSymbol name="square.and.arrow.up" size={18} color={iconColors.primary} />
              </Pressable>
              <Pressable onPress={clearLogs} style={{ padding: 4 }}>
                <IconSymbol name="trash" size={18} color="#ef4444" />
              </Pressable>
            </View>
          </View>

          <FlashList
            data={logs}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ color: '#64748b', fontSize: 14 }}>No logs yet</Text>
              </View>
            }
          />
        </View>
      </TrueSheet>
    </>
  );
}
