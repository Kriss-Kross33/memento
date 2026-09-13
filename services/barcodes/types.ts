import type { DetectedBarcode } from '@/models/document';

/**
 * Barcode / QR detection is a separate layer from OCR.
 * Detection is optional and never assumed to contain the total.
 */
export type BarcodeDetector = {
  detect(uri: string): Promise<DetectedBarcode[]>;
};

export const emptyBarcodeDetector: BarcodeDetector = {
  async detect() {
    return [];
  },
};
