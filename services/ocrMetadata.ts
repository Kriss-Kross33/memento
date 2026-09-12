import { OCRMetadata } from '@/models/types';
import type { ParsedReceipt } from '@/utils/receipt/types';

export const buildOcrMetadata = (
  parsed: ParsedReceipt | null,
  hadResult: boolean
): OCRMetadata => ({
  id: `ocr_${Date.now().toString(36)}`,
  receiptId: '',
  processingStatus: hadResult ? 'done' : 'skipped',
  merchantConfidence: parsed?.merchant.confidence ?? 0,
  dateConfidence: parsed?.date.confidence ?? 0,
  totalConfidence: parsed?.amount.confidence ?? 0,
  currencyConfidence: parsed?.currency.confidence ?? 0,
  categoryConfidence: parsed?.category.confidence ?? 0,
  itemsConfidence: parsed?.items.confidence ?? 0,
  overallConfidence: parsed?.overallConfidence ?? 0,
  processedAt: new Date().toISOString(),
});
