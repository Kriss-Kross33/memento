import type { OcrDocument, OcrLine, OcrResult } from '@/services/ocr/types';
import type { ParseFallback, ParsedReceipt, ParsedReceiptFields, ReceiptValidation } from '@/utils/receipt/types';
import { buildLayout } from '@/utils/receipt/layout';
import { resolveReceipt } from '@/utils/receipt/resolve';
import { extractAmounts } from '@/utils/receipt/amounts';
import { parseDateFromText } from '@/utils/receipt/date';
import { fuzzyHasTerm, TOTAL_TERMS, TAX_TERMS } from '@/utils/receipt/vocabulary';

const normalizeInput = (result: OcrDocument | OcrResult): OcrDocument => {
  const lines: OcrLine[] =
    result.lines.length > 0
      ? result.lines
      : result.text
          .split(/\n+/)
          .map((text, i) => ({
            text: text.trim(),
            boundingBox: { x: 0, y: i, width: Math.max(text.length * 8, 1), height: 1 },
          }))
          .filter((line) => line.text);
  const width = result.width > 0 ? result.width : Math.max(1, ...lines.map((line) => line.boundingBox.x + line.boundingBox.width));
  const height = result.height > 0 ? result.height : Math.max(1, ...lines.map((line) => line.boundingBox.y + line.boundingBox.height));
  return {
    text: result.text ?? '',
    lines,
    blocks: result.blocks ?? [],
    width,
    height,
  };
};

export const scoreOcrResult = (result: OcrResult): number => {
  const lines = result.lines.length > 0 ? result.lines : [{ text: result.text, boundingBox: { x: 0, y: 0, width: 0, height: 0 } }];
  const amountHits = lines.filter((line) => extractAmounts(line.text).length > 0).length;
  const dateHits = lines.filter((line) => parseDateFromText(line.text)).length;
  const totalHits = lines.filter((line) => fuzzyHasTerm(line.text, TOTAL_TERMS) && !fuzzyHasTerm(line.text, TAX_TERMS)).length;
  return lines.length + amountHits * 2 + dateHits * 3 + totalHits * 5;
};

export const parseReceiptDocument = (result: OcrDocument | OcrResult, fallback: ParseFallback): ParsedReceipt => {
  const normalized = normalizeInput(result);
  const layout = buildLayout(normalized);
  return resolveReceipt(layout, fallback);
};

/**
 * Legacy flatten. Prefer parseReceiptDocument() and read
 * parsed.merchant.value / parsed.merchant.confidence at the call site.
 * Only use this at a boundary that truly cannot accept ExtractedField.
 */
export const parseReceiptOcr = (result: OcrResult, fallback: ParseFallback): ParsedReceiptFields => {
  const parsed = parseReceiptDocument(result, fallback);
  const items = parsed.items.value;
  return {
    merchant: parsed.merchant.value,
    date: parsed.date.value,
    amount: parsed.amount.value,
    currency: parsed.currency.value,
    category: parsed.category.value,
    receiptNumber: parsed.receiptNumber?.value,
    notes: parsed.notes?.value,
    items: items.length > 0 ? items : undefined,
  };
};

export type { ParsedReceiptFields, ParsedReceipt, ParseFallback, ReceiptValidation };
export {
  needsReview,
  isLowFieldConfidence,
  isLowItemConfidence,
  verificationHints,
  verificationHintsFromOcr,
  reviewStateFromOverall,
  buildReviewRequirements,
  reviewHeadline,
  reviewSummaryFromOcr,
  attachReview,
  REVIEW_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
} from '@/utils/receipt/confidence';
export { validateReceipt } from '@/utils/receipt/validate';
