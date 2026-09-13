import { readReceipt, type ReadReceiptResult } from '@/services/ocr/pipeline';
import type { ParseFallback } from '@/utils/receipt/types';
import { captureSourceForInput, isPdfInput, isSupportedImageInput, type ReceiptInput } from '@/services/ingest/types';
import { rasterizePdfPages } from '@/services/ingest/pdf';
import { ingestReceiptPages, type IngestPagesResult, type IngestPageProgress } from '@/services/ingest/pages';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';

export type IngestUnsupportedReason = 'unsupported-type' | 'too-many-pages' | 'raster-failed' | 'pdf-not-implemented';

export type IngestResult = ReadReceiptResult & {
  input: ReceiptInput;
  pages?: IngestPagesResult;
  unsupportedReason?: IngestUnsupportedReason;
};

export { isSupportedImageInput, isPdfInput } from '@/services/ingest/types';

/**
 * Route camera photos, library images, files, PDFs, and share-sheet imports
 * into the existing Image → OCR → classify → parse pipeline.
 */
export const ingestReceiptInput = async (
  input: ReceiptInput,
  fallback: ParseFallback,
  options?: { force?: boolean; onProgress?: (progress: IngestPageProgress) => void }
): Promise<IngestResult> => {
  if (isPdfInput(input)) {
    const raster = await rasterizePdfPages(input.uri);
    if (raster.error === 'unsupported') {
      const empty = await readReceipt('', fallback, 'unknown', { force: true });
      return { ...empty, document: null, input, unsupportedReason: 'pdf-not-implemented' };
    }
    if (raster.error === 'too-many-pages') {
      const empty = await readReceipt('', fallback, 'unknown', { force: true });
      return { ...empty, document: null, input, unsupportedReason: 'too-many-pages' };
    }
    if (raster.uris.length === 0) {
      const empty = await readReceipt('', fallback, 'unknown', { force: true });
      return { ...empty, document: null, input, unsupportedReason: 'raster-failed' };
    }
    const pages = await ingestReceiptPages(
      raster.uris.slice(0, MAX_RECEIPT_PAGES).map((uri) => ({ uri, source: 'pdf', kind: 'pdf' })),
      fallback,
      options?.onProgress
    );
    const first = pages.pages[0];
    return {
      document: first?.document ?? null,
      parsed: pages.parsed,
      quality: {
        width: 0,
        height: 0,
        minSide: 0,
        maxSide: 0,
        source: 'unknown',
        issues: [],
        advice: 'ok',
      },
      plan: { reason: 'none', issues: [] },
      retries: 0,
      engine: 'unsupported',
      input,
      pages,
    };
  }

  if (!isSupportedImageInput(input)) {
    const empty = await readReceipt('', fallback, 'unknown', { force: true });
    return { ...empty, document: null, input, unsupportedReason: 'unsupported-type' };
  }

  const result = await readReceipt(input.uri, fallback, captureSourceForInput(input), options);
  return { ...result, input };
};

export { ingestReceiptPages } from '@/services/ingest/pages';
export { finalizeScannedReceipt, detectDuplicateBeforeSave } from '@/services/ingest/finalize';
export { mapParsedToReceiptFields, emptyReceiptFields } from '@/services/ingest/mapParsed';
export { rasterizePdfPages, isPdfRasterSupported } from '@/services/ingest/pdf';
export type { ReceiptInput, ReceiptInputKind } from '@/services/ingest/types';
export type { IngestPagesResult, IngestPageProgress } from '@/services/ingest/pages';
