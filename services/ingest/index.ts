import { readReceipt, type ReadReceiptResult } from '@/services/ocr/pipeline';
import type { ParseFallback } from '@/utils/receipt/types';
import { captureSourceForInput, isPdfInput, type ReceiptInput } from '@/services/ingest/types';

export type IngestResult = ReadReceiptResult & {
  input: ReceiptInput;
  unsupportedReason?: 'pdf-not-implemented';
};

/**
 * Route camera photos, library images, files, and share-sheet imports
 * into the existing OCR pipeline. PDF rasterization is prepared, not implemented.
 */
export const ingestReceiptInput = async (
  input: ReceiptInput,
  fallback: ParseFallback,
  options?: { force?: boolean }
): Promise<IngestResult> => {
  if (isPdfInput(input)) {
    const empty = await readReceipt('', fallback, 'unknown', { force: true });
    return {
      ...empty,
      document: null,
      input,
      unsupportedReason: 'pdf-not-implemented',
    };
  }
  const result = await readReceipt(input.uri, fallback, captureSourceForInput(input), options);
  return { ...result, input };
};

export type { ReceiptInput, ReceiptInputKind } from '@/services/ingest/types';
