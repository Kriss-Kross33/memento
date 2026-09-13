import { importReceiptImage } from '@/services/receiptMedia';
import { readReceipt } from '@/services/ocr/pipeline';
import type { OcrDocument } from '@/services/ocr/types';
import { captureSourceForInput, type ReceiptInput, type ReceiptInputKind } from '@/services/ingest/types';
import { parseReceiptPages } from '@/utils/receipt';
import { attachReview } from '@/utils/receipt/confidence';
import { applyLocalIntelligence } from '@/services/intelligence/store';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';
import type { ParseFallback, ParsedReceipt } from '@/utils/receipt/types';
import type { ReceiptMedia } from '@/models/types';

export type IngestPageInput = {
  uri: string;
  source: ReceiptMedia['source'];
  kind?: ReceiptInputKind;
};

export type IngestPageProgress = {
  page: number;
  total: number;
  message: string;
};

export type IngestedPage = {
  pageIndex: number;
  media: ReceiptMedia;
  document: OcrDocument | null;
  skippedReason?: string;
  error?: string;
};

export type IngestPagesResult = {
  pages: IngestedPage[];
  parsed: ParsedReceipt;
  failedIndexes: number[];
};

const kindForSource = (source: ReceiptMedia['source']): ReceiptInputKind => {
  if (source === 'camera') return 'camera';
  if (source === 'library') return 'photo';
  if (source === 'pdf') return 'pdf';
  if (source === 'share') return 'share';
  return 'file';
};

/**
 * Copy each page into managed storage, OCR independently, then merge once.
 * A failed page does not discard the others.
 */
export const ingestReceiptPages = async (
  inputs: IngestPageInput[],
  fallback: ParseFallback,
  onProgress?: (progress: IngestPageProgress) => void
): Promise<IngestPagesResult> => {
  const limited = inputs.slice(0, MAX_RECEIPT_PAGES);
  const pages: IngestedPage[] = [];
  const documents: OcrDocument[] = [];

  for (const [index, input] of limited.entries()) {
    onProgress?.({
      page: index + 1,
      total: limited.length,
      message: `Processing page ${index + 1} of ${limited.length}…`,
    });
    const media = await importReceiptImage(input.uri, input.source, { pageIndex: index });
    const kind = input.kind ?? kindForSource(input.source);
    const receiptInput: ReceiptInput = { kind, uri: media.uri, pageIndex: index };
    try {
      const result = await readReceipt(media.uri, fallback, captureSourceForInput(receiptInput));
      if (result.document) documents.push(result.document);
      pages.push({
        pageIndex: index,
        media,
        document: result.document,
        skippedReason: result.skippedReason,
      });
    } catch (error) {
      pages.push({
        pageIndex: index,
        media,
        document: null,
        error: error instanceof Error ? error.message : 'page-failed',
      });
    }
  }

  const parsed = attachReview(await applyLocalIntelligence(parseReceiptPages(documents, fallback)));
  return {
    pages,
    parsed,
    failedIndexes: pages.filter((page) => !page.document).map((page) => page.pageIndex),
  };
};
