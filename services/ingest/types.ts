import type { CaptureSource } from '@/services/ocr/imageQuality';

/**
 * Every entry point should become one of these, then flow into the
 * existing Image → OCR → classify → parse pipeline.
 */
export type ReceiptInputKind = 'camera' | 'photo' | 'file' | 'pdf' | 'share';

export type ReceiptInput = {
  kind: ReceiptInputKind;
  uri: string;
  mimeType?: string;
  fileName?: string;
  pageIndex?: number;
};

export const captureSourceForInput = (input: ReceiptInput): CaptureSource => {
  if (input.kind === 'camera') return 'camera';
  if (input.kind === 'photo') return 'library';
  return 'unknown';
};

export const isPdfInput = (input: ReceiptInput): boolean =>
  input.kind === 'pdf' ||
  (input.mimeType?.toLowerCase().includes('pdf') ?? false) ||
  (input.fileName?.toLowerCase().endsWith('.pdf') ?? false);
