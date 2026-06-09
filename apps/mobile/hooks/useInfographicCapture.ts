import { useCallback, useRef, useState } from 'react';
import { Image } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import type { ViewShotRef } from 'react-native-view-shot';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { useT } from '@/lib/i18n';

interface Preview {
  uri: string;
  aspect: number;
  contactName: string;
}

export function useInfographicCapture() {
  const t = useT();
  const { alert } = useCustomAlert();

  const infographicRefs = useRef<Record<number, ViewShotRef | null>>({});
  const billInfographicRef = useRef<ViewShotRef | null>(null);
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);
  const [isCapturingBill, setCapturingBill] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const captureInfographic = useCallback(async (contactIndex: number, contactName: string) => {
    const viewShotRef = infographicRefs.current[contactIndex];
    if (!viewShotRef?.capture) return;
    setCapturingIndex(contactIndex);
    try {
      const uri = await viewShotRef.capture();
      const { width, height } = await Image.getSize(uri);
      setPreview({ uri, aspect: width > 0 && height > 0 ? width / height : 0.55, contactName });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    } finally {
      setCapturingIndex(null);
    }
  }, [t, alert]);

  const captureBillInfographic = useCallback(async (billName: string) => {
    if (!billInfographicRef.current?.capture) return;
    setCapturingBill(true);
    try {
      const uri = await billInfographicRef.current.capture();
      const { width, height } = await Image.getSize(uri);
      setPreview({ uri, aspect: width > 0 && height > 0 ? width / height : 0.55, contactName: billName });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    } finally {
      setCapturingBill(false);
    }
  }, [t, alert]);

  const confirmShare = useCallback(async () => {
    if (!preview) return;
    try {
      await Sharing.shareAsync(preview.uri, { mimeType: 'image/png', dialogTitle: preview.contactName });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    }
  }, [preview, t, alert]);

  const closePreview = useCallback(() => setPreview(null), []);

  return {
    infographicRefs,
    billInfographicRef,
    capturingIndex,
    isCapturingBill,
    preview,
    captureInfographic,
    captureBillInfographic,
    confirmShare,
    closePreview,
  };
}
