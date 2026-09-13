import type { AmountCandidate, Anchor, LayoutDocument, LayoutLine, ReceiptRegions } from '@/utils/receipt/types';
import {
  CHANGE_TERMS,
  DISCOUNT_TERMS,
  PAYMENT_TERMS,
  SUBTOTAL_TERMS,
  TAX_TERMS,
  fuzzyHasTerm,
  isNonPayableTotal,
  isStrongTotalLabel,
  isTaxExclusiveSubtotal,
  isTaxInclusiveTotal,
} from '@/utils/receipt/vocabulary';

const isPhoneLike = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && !raw.includes('.') && !/[.,]\d{2}\b/.test(raw);
};

export const parseAmountToken = (raw: string): number | null => {
  if (/^\s*-/.test(raw) || isPhoneLike(raw)) return null;
  let token = raw.replace(/[GH₵$£€]|GHS|SGD|USD|GBP|EUR|GHC|cedis?/gi, '').trim();
  token = token.replace(/[^\d.,]/g, '');
  if (!token) return null;

  if (/^\d{1,3}(,\d{3})+(\.\d{1,4})?$/.test(token)) {
    token = token.replace(/,/g, '');
  } else if (/^\d+,\d{2}$/.test(token)) {
    token = token.replace(',', '.');
  } else {
    token = token.replace(/,/g, '');
  }

  const value = Number.parseFloat(token);
  if (!Number.isFinite(value) || value <= 0 || value >= 1_000_000) return null;
  if (value >= 1900 && value <= 2100 && !raw.includes('.') && !raw.includes(',')) return null;
  return Math.round(value * 100) / 100;
};

const AMOUNT_PATTERN =
  /(?:GH₵|GHC|GHS|SGD|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?\b|\b\d+,\d{2}\b|\b\d+\.\d{1,4}\b|[A-Za-z](\d+\.\d{1,4})\b/gi;

/** OCR often reads a trailing 0 as C on Ghana thermal printers (17C → 170). */
export const repairOcrAmountText = (line: string): string =>
  line.replace(/\b(\d{1,4})[C]\b/g, (_, digits: string) => `${digits}0`);

const isNegativeMatch = (line: string, index: number): boolean => {
  const before = line.slice(Math.max(0, index - 2), index);
  return /-\s*$/.test(before);
};

export const extractAmounts = (line: string): number[] => {
  const repaired = repairOcrAmountText(line);
  const standalone = repaired.trim().match(/^(?:GH₵|GHC|GHS|SGD|USD|GBP|EUR|[$£€₵])?\s*(\d{2,5}(?:[.,]\d{2})?)\s*$/i);
  if (standalone) {
    const value = parseAmountToken(standalone[1]);
    return value != null ? [value] : [];
  }
  const matches: string[] = [];
  const pattern = new RegExp(AMOUNT_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(repaired)) !== null) {
    if (isNegativeMatch(repaired, match.index)) continue;
    const after = repaired.slice(match.index + match[0].length, match.index + match[0].length + 3);
    if (/^\s*%/.test(after)) continue;
    matches.push(match[1] ?? match[0]);
  }
  return matches.map(parseAmountToken).filter((n): n is number => n !== null);
};

export const contextFor = (layout: LayoutDocument, line: LayoutLine, position: number): string => {
  const row = layout.rows.find((entry) => entry.lines.some((item) => item.index === line.index));
  const rowText = row ? row.lines.map((item) => item.text).join(' ') : line.text;
  const prev = layout.lines[position - 1];
  const prevClose =
    prev && Math.abs(prev.centerY - line.centerY) <= Math.max(prev.box.height, line.box.height, 24) * 1.6;
  return prevClose ? `${prev.text} ${rowText}` : rowText;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const nearestAnchorDistance = (anchors: Anchor[], role: Anchor['role'], lineIndex: number): number => {
  const matches = anchors.filter((anchor) => anchor.role === role);
  if (matches.length === 0) return 99;
  return Math.min(...matches.map((anchor) => Math.abs(anchor.lineIndex - lineIndex)));
};

export const scoreAmountRoles = (
  line: LayoutLine,
  context: string,
  value: number,
  allValues: number[],
  anchors: Anchor[],
  regions?: ReceiptRegions
): AmountCandidate['roleScores'] => {
  const inItems = regions ? line.index < regions.itemMaxLineIndex : line.normalizedY < 0.7;
  const inTotals = regions
    ? line.index >= regions.totalsMinLineIndex && line.index <= regions.totalsMaxLineIndex + 1
    : line.normalizedY >= 0.62;
  const repeats = allValues.filter((entry) => Math.abs(entry - value) < 0.005).length;
  const neighborHasWords = /[a-z]{3}/i.test(context.replace(/[\d.,$£€₵]/g, ''));
  const taxHeader = isTaxInclusiveTotal(context) || isTaxExclusiveSubtotal(context);
  const taxNear =
    !taxHeader &&
    (nearestAnchorDistance(anchors, 'tax', line.index) <= 1 || fuzzyHasTerm(context, TAX_TERMS));
  const paymentNear =
    nearestAnchorDistance(anchors, 'payment', line.index) <= 1 || fuzzyHasTerm(context, PAYMENT_TERMS);
  const changeNear = nearestAnchorDistance(anchors, 'change', line.index) <= 1 || fuzzyHasTerm(context, CHANGE_TERMS);
  const subtotalLabel = fuzzyHasTerm(context, SUBTOTAL_TERMS) || isTaxExclusiveSubtotal(context);
  const discountNear =
    nearestAnchorDistance(anchors, 'discount', line.index) <= 1 || fuzzyHasTerm(context, DISCOUNT_TERMS);
  const strongTotal =
    (isStrongTotalLabel(context) || isTaxInclusiveTotal(context)) && !isNonPayableTotal(context);

  const labelScore = strongTotal ? 0.95 : 0.08;
  const regionScore = inTotals ? 0.22 : inItems ? -0.12 : 0.04;
  const rightAlignmentScore = line.rightColumnScore * 0.18;
  const neighborScore = neighborHasWords && strongTotal ? 0.08 : 0;
  const taxPenalty = taxNear && !strongTotal ? 0.55 : taxNear ? 0.2 : 0;
  const paymentPenalty = paymentNear && !strongTotal ? 0.35 : 0;
  const itemPenalty = inItems && repeats >= 3 ? 0.28 : 0;

  return {
    itemPrice: clamp01(
      line.rightColumnScore * 0.45 +
        (inItems ? 0.28 : 0) +
        (neighborHasWords && inItems ? 0.12 : 0) -
        (strongTotal ? 0.45 : 0) -
        (taxNear || paymentNear || changeNear || subtotalLabel || discountNear ? 0.4 : 0)
    ),
    subtotal: clamp01((subtotalLabel ? 0.92 : 0.06) + (inTotals ? 0.08 : 0)),
    tax: clamp01((taxNear ? 0.9 : 0.06) + (inTotals ? 0.06 : 0) - (strongTotal ? 0.25 : 0)),
    discount: clamp01((discountNear ? 0.9 : 0.04) + (inTotals ? 0.06 : 0) - (strongTotal ? 0.25 : 0)),
    total: clamp01(
      labelScore + regionScore + rightAlignmentScore + neighborScore - taxPenalty - paymentPenalty - itemPenalty
    ),
    cash: clamp01((paymentNear ? 0.72 : 0.06) + (inTotals ? 0.08 : 0) - (strongTotal ? 0.3 : 0)),
    change: clamp01(changeNear ? 0.92 : 0.04),
    unknown: 0.18,
  };
};

export const extractAmountCandidates = (
  layout: LayoutDocument,
  anchors: Anchor[] = [],
  regions?: ReceiptRegions
): AmountCandidate[] => {
  const collected = layout.lines.flatMap((line, position) => {
    const values = extractAmounts(line.text);
    const context = contextFor(layout, line, position);
    return values.map((value) => ({ line, position, value, context }));
  });
  const allValues = collected.map((entry) => entry.value);

  return collected.map((entry) => {
    const roleScores = scoreAmountRoles(
      entry.line,
      entry.context,
      entry.value,
      allValues,
      anchors,
      regions
    );
    return {
      value: entry.value,
      text: entry.context,
      box: entry.line.box,
      lineIndex: entry.line.index,
      roleScores,
      confidence: Math.max(...Object.values(roleScores)),
    };
  });
};
