import { Platform } from 'react-native';

const isCancel = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
};

/**
 * Opens the system document scanner (VisionKit on iOS, ML Kit on Android).
 * Detects receipt edges, auto-captures, and returns a cropped image URI.
 * Returns null if the user cancels or the native scanner is unavailable.
 */
export async function scanReceiptDocument(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { scanDocument } = await import('expo-document-scanner');
    const result = await scanDocument({
      quality: 1,
      maxNumDocuments: 1,
      scannerMode: 'full',
      galleryImportAllowed: false,
    });
    return result.pages[0]?.uri ?? null;
  } catch (error) {
    if (isCancel(error)) return null;
    console.warn('[scanner] native document scan failed', error);
    throw error;
  }
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
