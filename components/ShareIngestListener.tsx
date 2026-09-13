import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useReceipts } from '@/context/ReceiptsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { toISODate } from '@/components/DatePickerField';
import {
  finalizeScannedReceipt,
  ingestReceiptInput,
  mapParsedToReceiptFields,
} from '@/services/ingest';
import { receiptInputFromIncomingUrl } from '@/services/ingest/incoming';

/** App-level share / open-in: one incoming file becomes one purchase. */
export default function ShareIngestListener() {
  const router = useRouter();
  const { addReceipt, defaultCurrency, receipts } = useReceipts();
  const { requestScan, consumeScan } = useSubscription();
  const busy = useRef(false);

  useEffect(() => {
    const ingestUrl = async (url: string | null) => {
      if (!url || busy.current) return;
      const incomingParam = (() => {
        try {
          const parsed = Linking.parse(url);
          const value = parsed.queryParams?.incoming;
          return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
        } catch {
          return undefined;
        }
      })();
      const input = receiptInputFromIncomingUrl(incomingParam || url);
      if (!input) return;
      busy.current = true;
      try {
        const allowed = await requestScan();
        if (!allowed) {
          router.push('/paywall?reason=scans');
          return;
        }
        const fallback = { date: toISODate(new Date()), currency: defaultCurrency };
        const result = await ingestReceiptInput(input, fallback);
        if (result.unsupportedReason) {
          Alert.alert(
            result.unsupportedReason === 'too-many-pages'
              ? 'This PDF has too many pages'
              : result.unsupportedReason === 'unsupported-type'
                ? "That file isn't supported"
                : "This file couldn't be read",
            'Try a JPEG, PNG, HEIC, WebP, or a shorter PDF.'
          );
          return;
        }
        const fields = mapParsedToReceiptFields(result.parsed, fallback, Boolean(result.document || result.pages));
        const incoming = {
          ...fields,
          media: result.pages?.pages[0]?.media,
          sourceMedia: result.pages?.pages.map((page) => page.media),
        };
        const finalized = await finalizeScannedReceipt(incoming, receipts, { addReceipt, consumeScan });
        if (finalized.status === 'duplicate') {
          Alert.alert(
            'This looks like a receipt you already saved.',
            'You can open the existing receipt or keep both.',
            [
              { text: 'Review existing', onPress: () => router.push(`/receipt/${finalized.match.receiptId}`) },
              {
                text: 'Save anyway',
                onPress: () => {
                  void finalizeScannedReceipt(incoming, receipts, { addReceipt, consumeScan }, { saveAnyway: true }).then(
                    (saved) => {
                      if (saved.status === 'saved') router.push(`/receipt/${saved.id}?scanned=1`);
                    }
                  );
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
        router.push(`/receipt/${finalized.id}?scanned=1`);
      } catch (error) {
        console.warn('[share] ingest failed', error);
        Alert.alert("Shared file couldn't be saved", 'Try importing it from Scan.');
      } finally {
        busy.current = false;
      }
    };

    void Linking.getInitialURL().then((url) => void ingestUrl(url));
    const sub = Linking.addEventListener('url', ({ url }) => {
      void ingestUrl(url);
    });
    return () => sub.remove();
  }, [addReceipt, consumeScan, defaultCurrency, receipts, requestScan, router]);

  if (Platform.OS === 'web') return null;
  return null;
}
