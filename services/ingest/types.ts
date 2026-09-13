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

const IMAGE_EXTENSION = /\.(jpe?g|png|heic|webp)$/i;
const IMAGE_MIME = /image\/(jpeg|jpg|png|heic|heif|webp)/i;

export const isSupportedImageInput = (input: ReceiptInput): boolean => {
  if (isPdfInput(input)) return false;
  if (input.mimeType && IMAGE_MIME.test(input.mimeType)) return true;
  if (input.fileName && IMAGE_EXTENSION.test(input.fileName)) return true;
  if (input.kind === 'camera' || input.kind === 'photo' || input.kind === 'file' || input.kind === 'share') {
    return !input.mimeType || input.mimeType.startsWith('image/');
  }
  return IMAGE_EXTENSION.test(input.uri);
};
