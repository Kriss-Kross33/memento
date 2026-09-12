import type { DocumentClassification } from '@/models/document';
import type { Anchor, LayoutDocument, ParsedReceipt } from '@/utils/receipt/types';
import { extractAmountCandidates } from '@/utils/receipt/amounts';
import { parseItems } from '@/utils/receipt/items';
import { pickDateCandidate } from '@/utils/receipt/date';
import { pickMerchantCandidate, isEcgReceipt } from '@/utils/receipt/merchant';
import { deriveRegions, findAnchors } from '@/utils/receipt/anchors';
import { resolveCurrency, guessCategoryCandidate } from '@/utils/receipt/currency';
import { extractDiscounts, extractTaxes, pickPrintedSubtotal, sumCharges, sumDiscounts } from '@/utils/receipt/charges';
import { extractExplicitReturnPolicy, extractExplicitWarranty } from '@/utils/receipt/lifecycle';
import { buildFieldExplanations } from '@/utils/receipt/explanations';
import { validateReceipt } from '@/utils/receipt/validate';
import { attachReview } from '@/utils/receipt/confidence';
import { blendOcrConfidence, extracted } from '@/utils/receipt/field';

export type ResolveExtras = {
  classification?: DocumentClassification;
  anchors?: Anchor[];
};

const pickTotal = (
  layout: LayoutDocument,
  totalsMin: number,
  totalsMax: number,
  amounts = extractAmountCandidates(layout)
): { value: number; confidence: number; source: string; lineIndex?: number } => {
  const region = amounts.filter(
    (candidate) => candidate.lineIndex >= totalsMin && candidate.lineIndex <= totalsMax + 1
  );
  if (region.length === 0) return { value: 0, confidence: 0.2, source: 'none' };
  const scored = region
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
  const labeled = scored.filter((candidate) => candidate.roleScores.total >= 0.72);
  const chosen = labeled[0] ?? scored[0];
  if (!chosen) return { value: 0, confidence: 0.2, source: 'none' };
  return {
    value: chosen.value,
    confidence: Math.min(0.99, Math.max(0.2, chosen.score)),
    source: chosen.text,
    lineIndex: chosen.lineIndex,
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
  fallback: { date: string; currency: import('@/utils/currency').Currency },
  extras: ResolveExtras = {}
): ParsedReceipt => {
  const anchors = extras.anchors ?? findAnchors(layout);
  const regions = deriveRegions(layout, anchors);
  const amounts = extractAmountCandidates(layout, anchors, regions);
  const fullText = layout.lines.map((line) => line.text).join('\n');

  const merchantCandidate = pickMerchantCandidate(layout);
  const dateCandidate = pickDateCandidate(layout, fallback.date);
  const totalCandidate = pickTotal(layout, regions.totalsMinLineIndex, regions.totalsMaxLineIndex, amounts);
  const totalLine =
    totalCandidate.lineIndex != null ? layout.lines.find((line) => line.index === totalCandidate.lineIndex) : undefined;
  const currencyCandidate = resolveCurrency(layout, merchantCandidate.value, fallback.currency);
  const categoryCandidate = isEcgReceipt(fullText)
    ? { value: 'Utilities', confidence: 0.95, source: 'ecg-signature' }
    : guessCategoryCandidate(fullText, merchantCandidate.value, merchantCandidate.categoryHint);
  const itemsCandidate = parseItems(layout, totalCandidate.value, regions.itemMaxLineIndex);
  const receiptNumber = parseReceiptNumber(fullText, layout.lines.map((line) => line.text));
  const notes = buildNotes(receiptNumber.value);
  const receiptNumberLine = receiptNumber.source
    ? layout.lines.find((line) => line.text.includes(receiptNumber.source) || receiptNumber.source.includes(line.text))
    : undefined;
  const taxes = extractTaxes(layout, amounts);
  const discounts = extractDiscounts(layout, amounts);
  const printedSubtotal = pickPrintedSubtotal(amounts);
  const taxTotal = sumCharges(taxes);
  const discountTotal = sumDiscounts(discounts);
  const warranty = extractExplicitWarranty(fullText, dateCandidate.value);
  const returnPolicy = extractExplicitReturnPolicy(fullText, dateCandidate.value);

  const merchant = extracted(
    merchantCandidate.value,
    blendOcrConfidence(merchantCandidate.confidence, merchantCandidate.line),
    merchantCandidate.line,
    merchantCandidate.source
  );
  const date = extracted(
    dateCandidate.value,
    blendOcrConfidence(dateCandidate.confidence, dateCandidate.line),
    dateCandidate.line,
    dateCandidate.source
  );
  const amount = extracted(
    totalCandidate.value,
    blendOcrConfidence(totalCandidate.confidence, totalLine),
    totalLine,
    totalCandidate.source
  );
  const currency = extracted(currencyCandidate.value, currencyCandidate.confidence, undefined, currencyCandidate.source);
  const category = extracted(categoryCandidate.value, categoryCandidate.confidence, undefined, categoryCandidate.source);
  const items = extracted(itemsCandidate.items, itemsCandidate.confidence, undefined, 'item-matcher');
  const validation = validateReceipt({
    total: amount.value,
    items: items.value,
    amounts,
    subtotal: printedSubtotal,
    discount: discountTotal,
    taxes,
    discounts,
  });

  const parsed = {
    merchant,
    date,
    amount,
    currency,
    category,
    receiptNumber: extracted(receiptNumber.value, receiptNumber.confidence, receiptNumberLine, receiptNumber.source),
    notes: extracted(notes, notes ? 0.8 : 0.4, receiptNumberLine, notes ? 'receipt-number' : 'none'),
    items,
    subtotal: extracted(printedSubtotal, printedSubtotal != null ? 0.86 : 0.2, undefined, printedSubtotal != null ? 'subtotal' : 'none'),
    tax: extracted(taxTotal || undefined, taxTotal > 0 ? 0.82 : 0.2, undefined, taxTotal > 0 ? 'taxes' : 'none'),
    discount: extracted(discountTotal || undefined, discountTotal > 0 ? 0.8 : 0.2, undefined, discountTotal > 0 ? 'discounts' : 'none'),
    taxes,
    discounts,
    documentType: extras.classification,
    warranty,
    returnPolicy,
    explanations: [] as ReturnType<typeof buildFieldExplanations>,
    validation,
  };
  parsed.explanations = buildFieldExplanations({ parsed, amounts });

  return attachReview(parsed);
};
