import { Platform } from 'react-native';
import type { OcrDocument } from '@/services/ocr/types';
import {
  assessImageQuality,
  choosePreprocessPlan,
  type CaptureSource,
  type ImageQuality,
  type PreprocessPlan,
} from '@/services/ocr/imageQuality';
import { applyPreprocessPlan } from '@/services/ocrPreprocess';
import { recognizeTextOnImage } from '@/services/ocr';
import { parseReceiptDocument, scoreOcrResult } from '@/utils/receipt';
import { RETRY_CONFIDENCE } from '@/utils/receipt/confidence';
import type { ParseFallback, ParsedReceipt } from '@/utils/receipt/types';

export type ReadReceiptResult = {
  document: OcrDocument | null;
  parsed: ParsedReceipt;
  quality: ImageQuality;
  plan: PreprocessPlan;
  retries: number;
};

const emptyParsed = (fallback: ParseFallback): ParsedReceipt => ({
  merchant: { value: '', confidence: 0, source: 'none' },
  date: { value: fallback.date, confidence: 0.4, source: 'fallback' },
  amount: { value: 0, confidence: 0, source: 'none' },
  currency: { value: fallback.currency, confidence: 0.4, source: 'fallback' },
  category: { value: 'Other', confidence: 0.4, source: 'fallback' },
  items: { value: [], confidence: 0, source: 'none' },
  overallConfidence: 0,
});

const forcedUpscale = (quality: ImageQuality): PreprocessPlan => {
  if (quality.width <= quality.height) return { resizeToWidth: 1600, reason: 'upscale-small' };
  return { resizeToHeight: 1600, reason: 'upscale-small' };
};

const rank = (document: OcrDocument | null, parsed: ParsedReceipt): number =>
  (document ? scoreOcrResult(document) : 0) + parsed.overallConfidence * 20;

const isThin = (document: OcrDocument | null, parsed: ParsedReceipt): boolean =>
  !document ||
  parsed.overallConfidence < RETRY_CONFIDENCE ||
  (parsed.amount.value <= 0 && parsed.items.value.length === 0);

/**
 * Quality plan → one OCR pass → parse. Retries once only when the first
 * read looks thin (low confidence, or no total and no items).
 */
export async function readReceipt(
  uri: string,
  fallback: ParseFallback,
  source: CaptureSource = 'unknown'
): Promise<ReadReceiptResult> {
  const quality =
    Platform.OS === 'web' || !uri
      ? { width: 0, height: 0, minSide: 0, maxSide: 0, source }
      : await assessImageQuality(uri, source);
  const plan = choosePreprocessPlan(quality);
  const prepared = await applyPreprocessPlan(uri, plan);
  let document = await recognizeTextOnImage(
    prepared,
    plan.reason === 'none' ? 'pass:original' : `pass:${plan.reason}`
  );
  let parsed = document ? parseReceiptDocument(document, fallback) : emptyParsed(fallback);
  let retries = 0;

  if (isThin(document, parsed) && Platform.OS !== 'web' && uri) {
    let retryUri: string | null = null;
    let retryLabel = 'retry';
    if (prepared !== uri) {
      retryUri = uri;
      retryLabel = 'retry:original';
    } else if (quality.minSide > 0 && quality.minSide < 1600) {
      const upscaled = await applyPreprocessPlan(uri, forcedUpscale(quality));
      if (upscaled !== uri) {
        retryUri = upscaled;
        retryLabel = 'retry:upscale';
      }
    }

    if (retryUri) {
      retries = 1;
      const second = await recognizeTextOnImage(retryUri, retryLabel);
      if (second) {
        const secondParsed = parseReceiptDocument(second, fallback);
        if (rank(second, secondParsed) > rank(document, parsed)) {
          document = second;
          parsed = secondParsed;
        }
      }
    }
  }

  if (__DEV__) {
    console.log('[ocr] parsed', {
      merchant: parsed.merchant.value,
      date: parsed.date.value,
      amount: parsed.amount.value,
      currency: parsed.currency.value,
      category: parsed.category.value,
      receiptNumber: parsed.receiptNumber?.value,
      notes: parsed.notes?.value,
      overallConfidence: parsed.overallConfidence,
      retries,
      items: parsed.items.value.map((item) => ({
        label: item.label,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        confidence: item.confidence,
      })),
    });
  }

  return { document, parsed, quality, plan, retries };
}
