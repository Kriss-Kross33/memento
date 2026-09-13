import { Platform } from 'react-native';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';

const isCancel = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
};

/**
 * Opens the system document scanner (VisionKit on iOS, ML Kit on Android).
 * Returns cropped page URIs, or an empty list if the user cancels.
 */
export async function scanReceiptDocuments(): Promise<string[]> {
  if (Platform.OS === 'web') return [];

  try {
    const { scanDocument } = await import('expo-document-scanner');
    const result = await scanDocument({
      quality: 1,
      maxNumDocuments: MAX_RECEIPT_PAGES,
      scannerMode: 'full',
      galleryImportAllowed: false,
    });
    return (result.pages ?? []).map((page) => page.uri).filter(Boolean);
  } catch (error) {
    if (isCancel(error)) return [];
    console.warn('[scanner] native document scan failed', error);
    throw error;
  }
}

export async function scanReceiptDocument(): Promise<string | null> {
  const pages = await scanReceiptDocuments();
  return pages[0] ?? null;
}

export async function isDocumentScannerAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await import('expo-document-scanner');
    return true;
  } catch {
    return false;
  }
}
