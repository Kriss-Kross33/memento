import type { LayoutDocument, ParsedReceipt } from '@/utils/receipt/types';
import { extractAmountCandidates } from '@/utils/receipt/amounts';
import { parseItems } from '@/utils/receipt/items';
import { pickDateCandidate } from '@/utils/receipt/date';
import { pickMerchantCandidate, isEcgReceipt } from '@/utils/receipt/merchant';
import { deriveRegions, findAnchors } from '@/utils/receipt/anchors';
import { pickCurrencyCandidate, guessCategoryCandidate } from '@/utils/receipt/currency';

const pickTotal = (
  layout: LayoutDocument,
  totalsMin: number,
  totalsMax: number
): { value: number; confidence: number; source: string } => {
  const amounts = extractAmountCandidates(layout).filter(
    (candidate) => candidate.lineIndex >= totalsMin && candidate.lineIndex <= totalsMax + 1
  );
  if (amounts.length === 0) return { value: 0, confidence: 0.2, source: 'none' };
  const scored = amounts
    .filter((candidate) => !/%/.test(candidate.text) || candidate.roleScores.total >= 0.8)
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.roleScores.total * 0.85 +
        candidate.roleScores.subtotal * 0.15 -
        candidate.roleScores.change * 0.75 -
        candidate.roleScores.tax * 0.55 -
        candidate.roleScores.cash * 0.25,
    }))
    .sort((a, b) => b.score - a.score || b.value - a.value || b.lineIndex - a.lineIndex);
  const labeled = scored.filter((candidate) => candidate.roleScores.total >= 0.8);
  const chosen = labeled[0] ?? scored[0];
  if (!chosen) return { value: 0, confidence: 0.2, source: 'none' };
  return {
    value: chosen.value,
    confidence: Math.min(0.99, Math.max(0.2, chosen.score)),
    source: chosen.text,
  };
};

const parseReceiptNumber = (text: string, lines: string[]): { value?: string; confidence: number; source: string } => {
  const sc = text.match(/\bSC[-–]+\s*[\d\s|]{8,}/i);
  if (sc) {
    const cleaned = sc[0].replace(/\|/g, '1').replace(/\s+/g, '');
    if (cleaned.length >= 8) return { value: cleaned, confidence: 0.84, source: sc[0] };
  }
  const labeled = text.match(
    /\b(?:receipt|invoice|ref(?:erence)?)\s*(?:no\.?)?\s*[#:.-]*\s*([A-Z0-9][A-Z0-9-]{5,})/i
  );
  if (labeled?.[1]) return { value: labeled[1], confidence: 0.8, source: labeled[0] };
  const check = text.match(/\b(?:chk|check|chek|chck|crieck|criek)\s*[#:]+\s*(\d{3,8})\b/i);
  if (check?.[1]) return { value: check[1], confidence: 0.78, source: check[0] };
  const terminal = text.match(/\bTR#\s*(\d{3,8})\b/i);
  if (terminal?.[1]) return { value: terminal[1], confidence: 0.74, source: terminal[0] };
  const orderIdx = lines.findIndex((line) => /^order\s*#?\s*$/i.test(line));
  const orderNext = orderIdx >= 0 ? lines[orderIdx + 1]?.trim() : '';
  if (/^\d{3,8}$/.test(orderNext)) return { value: orderNext, confidence: 0.68, source: orderNext };
  return { confidence: 0.2, source: 'none' };
};

const buildNotes = (receiptNumber: string | undefined): string | undefined => {
  return receiptNumber ? `Receipt No. ${receiptNumber}` : undefined;
};

export const resolveReceipt = (
  layout: LayoutDocument,
  fallback: { date: string; currency: import('@/utils/currency').Currency }
): ParsedReceipt => {
  const anchors = findAnchors(layout);
  const regions = deriveRegions(layout, anchors);
  const fullText = layout.lines.map((line) => line.text).join('\n');

  const merchantCandidate = pickMerchantCandidate(layout);
  const dateCandidate = pickDateCandidate(layout, fallback.date);
  const totalCandidate = pickTotal(layout, regions.totalsMinLineIndex, regions.totalsMaxLineIndex);
  const currencyCandidate = pickCurrencyCandidate(layout, merchantCandidate.value, fallback.currency);
  const categoryCandidate = isEcgReceipt(fullText)
    ? { value: 'Utilities', confidence: 0.95, source: 'ecg-signature' }
    : guessCategoryCandidate(fullText, merchantCandidate.value, merchantCandidate.categoryHint);
  const itemsCandidate = parseItems(layout, totalCandidate.value, regions.itemMaxLineIndex);
  const receiptNumber = parseReceiptNumber(fullText, layout.lines.map((line) => line.text));
  const notes = buildNotes(receiptNumber.value);

  const confidenceValues = [
    merchantCandidate.confidence,
    dateCandidate.confidence,
    totalCandidate.confidence,
    currencyCandidate.confidence,
    categoryCandidate.confidence,
    itemsCandidate.confidence,
  ];
  const overallConfidence = Number(
    (confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3)
  );

  return {
    merchant: { value: merchantCandidate.value, confidence: merchantCandidate.confidence, source: merchantCandidate.source },
    date: { value: dateCandidate.value, confidence: dateCandidate.confidence, source: dateCandidate.source },
    amount: { value: totalCandidate.value, confidence: totalCandidate.confidence, source: totalCandidate.source },
    currency: { value: currencyCandidate.value, confidence: currencyCandidate.confidence, source: currencyCandidate.source },
    category: { value: categoryCandidate.value, confidence: categoryCandidate.confidence, source: categoryCandidate.source },
    receiptNumber: { value: receiptNumber.value, confidence: receiptNumber.confidence, source: receiptNumber.source },
    notes: { value: notes, confidence: notes ? 0.8 : 0.4, source: notes ? 'receipt-number' : 'none' },
    items: {
      value: itemsCandidate.items,
      confidence: itemsCandidate.confidence,
      source: 'item-matcher',
    },
    overallConfidence,
  };
};
