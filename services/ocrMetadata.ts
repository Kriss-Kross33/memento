import { OCRMetadata } from '@/models/types';
import type { ParsedReceiptFields } from '@/utils/parseReceiptOcr';

export const buildOcrMetadata = (
  parsed: ParsedReceiptFields,
  hadResult: boolean
): OCRMetadata => ({
  id: `ocr_${Date.now().toString(36)}`,
  receiptId: '',
  processingStatus: hadResult ? 'done' : 'skipped',
  merchantConfidence: parsed.merchant.trim() ? 0.72 : 0,
  dateConfidence: parsed.date ? 0.64 : 0,
  totalConfidence: parsed.amount > 0 ? 0.78 : 0,
  currencyConfidence: 0.8,
  processedAt: new Date().toISOString(),
});
