import type { ReceiptItem } from '@/models/types';
import type { LayoutDocument } from '@/utils/receipt/types';
import { extractAmounts, parseAmountToken } from '@/utils/receipt/amounts';
import { assignMaxWeight } from '@/utils/receipt/assignment';
import {
  CHANGE_TERMS,
  DISCOUNT_TERMS,
  HEADER_NOISE_TERMS,
  PAYMENT_TERMS,
  SERVICE_TERMS,
  SUBTOTAL_TERMS,
  TAX_TERMS,
  TOTAL_TERMS,
  fuzzyHasTerm,
  isColumnHeaderLabel,
  isStrongTotalLabel,
  isTaxExclusiveSubtotal,
  isTaxInclusiveTotal,
} from '@/utils/receipt/vocabulary';
import { MAX_ITEM_LABEL_LENGTH, MAX_ITEM_QUANTITY, MAX_RECEIPT_ITEMS } from '@/utils/receipt/limits';

type ItemCandidate = {
  lineIndex: number;
  label: string;
  quantity: number;
  unitAt?: number;
  y: number;
  x: number;
};

type PriceCandidate = {
  lineIndex: number;
  amount: number;
  y: number;
  x: number;
};

const BARCODE = /\b\d{8,14}[A-Z]{0,2}\b/g;
const PRICE_LINE = /^\s*(?:[$£€₵])?\s*\d+(?:[.,]\d{2})?\s*[ONXTFE0C]?\s*$/i;
const QTY_NOTE = /^\d+\s*(?:AT|FOR|lb|1b)\b/i;
const JUNK_LABEL = /^(at|for|lb|1b|f|kf|n|o|x|t|ghs|ghc)$/i;

const cleanLabel = (value: string): string =>
  value
    .replace(/(?:GH₵|GHC|GHS|SGD|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*/gi, '')
    .replace(BARCODE, '')
    .replace(/[A-Z]?\d+[.,]\d{2}(?:\s*[ONXTFE0])?\s*$/i, '')
    .replace(/\b\d+[.,]\d{2}\b/g, '')
    .replace(/\b[ONXTFE]\s*$/i, '')
    .replace(/@\s*$/g, '')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseQtyAndLabel = (raw: string): { quantity: number; label: string; unitAt?: number } => {
  let work = raw.replace(/\s+/g, ' ').trim();
  let unitAt: number | undefined;
  const atMatch = work.match(/@\s*([\d.,]+)/);
  if (atMatch) {
    unitAt = parseAmountToken(atMatch[1]) ?? undefined;
    work = work.replace(/@\s*[\d.,]+/, '').trim();
  }
  const trailingUnit = work.match(/[B$S]?\s*(\d+[.,]\d{2})\s*$/i);
  if (unitAt == null && trailingUnit) {
    unitAt = parseAmountToken(trailingUnit[1]) ?? undefined;
    work = work.slice(0, trailingUnit.index).trim();
  }
  const spaced = work.match(/^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i);
  if (spaced) return { quantity: Number(spaced[1]) || 1, label: cleanLabel(spaced[2]), unitAt };
  const stuck = work.match(/^(\d{1,2})([A-Za-z].+)$/);
  if (stuck) return { quantity: Number(stuck[1]) || 1, label: cleanLabel(stuck[2]), unitAt };
  return { quantity: 1, label: cleanLabel(work), unitAt };
};

const isServiceOrNoise = (text: string): boolean =>
  fuzzyHasTerm(text, SERVICE_TERMS, 0.8) ||
  fuzzyHasTerm(text, TAX_TERMS, 0.8) ||
  isStrongTotalLabel(text) ||
  fuzzyHasTerm(text, TOTAL_TERMS) ||
  fuzzyHasTerm(text, SUBTOTAL_TERMS) ||
  fuzzyHasTerm(text, PAYMENT_TERMS) ||
  fuzzyHasTerm(text, CHANGE_TERMS) ||
  fuzzyHasTerm(text, HEADER_NOISE_TERMS) ||
  fuzzyHasTerm(text, DISCOUNT_TERMS) ||
  isColumnHeaderLabel(text) ||
  isTaxExclusiveSubtotal(text) ||
  isTaxInclusiveTotal(text) ||
  /\b(levy|nhil|getfund|covid)\b/i.test(text) ||
  /\b(pte\.?\s*ltd|llc|inc\.?|reg\.?\s*no)\b/i.test(text) ||
  /^free\b/i.test(text) ||
  QTY_NOTE.test(text) ||
  /^0{3,}\d+[A-Z]{0,2}$/i.test(text) ||
  /^\d{8,}[A-Z]{0,2}$/i.test(text);

const almost = (a: number, b: number, slack = 0.08): boolean => Math.abs(a - b) <= slack;

/** Layout D prints PRICE and AMOUNT. Keep only the right-hand line-total column. */
const keepLineTotalPrices = (prices: PriceCandidate[], docWidth: number): PriceCandidate[] => {
  const right = prices.filter((price) => price.x >= docWidth * 0.48);
  if (right.length < 4) return prices;
  const sorted = [...right].sort((a, b) => a.x - b.x);
  let gapAt = 0;
  let gap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].x - sorted[i - 1].x;
    if (delta > gap) {
      gap = delta;
      gapAt = i;
    }
  }
  if (gap < 70) return prices;
  const amountColumn = new Set(sorted.slice(gapAt));
  if (amountColumn.size < 2) return prices;
  return prices.filter((price) => price.x < docWidth * 0.48 || amountColumn.has(price));
};

const dropFalseItems = (items: ReceiptItem[], total: number): ReceiptItem[] => {
  const products = items.filter((item) => {
    if (isColumnHeaderLabel(item.label) || JUNK_LABEL.test(item.label)) return false;
    if (/^total\b/i.test(item.label)) return false;
    if (isTaxExclusiveSubtotal(item.label) || isTaxInclusiveTotal(item.label)) return false;
    if (isServiceOrNoise(item.label)) return false;
    if (total > 0 && items.length > 1 && almost(item.total ?? item.unitPrice, total, 0.05)) return false;
    return true;
  });
  if (products.length === 0) return items;
  const sum = (list: ReceiptItem[]) =>
    list.reduce((acc, item) => acc + (item.total ?? item.quantity * item.unitPrice), 0);
  if (total > 0 && sum(items) > total + 0.2 && sum(products) <= total + 0.2) {
    return products;
  }
  return products;
};

const pairScore = (item: ItemCandidate, price: PriceCandidate, docWidth: number): number => {
  const dy = price.y - item.y;
  // Walmart-style columns put the price on the same row or just below the label.
  if (dy < -12 || dy > 115) return 0;
  const verticalScore = Math.max(0, 1 - Math.abs(dy) / 115);
  const dx = Math.max(0, price.x - item.x);
  const horizontalScore = Math.min(1, dx / Math.max(docWidth * 0.4, 1));
  const rightBias = Math.min(1, price.x / Math.max(docWidth, 1));
  const qtyScore = item.unitAt ? Math.max(0, 1 - Math.abs(item.unitAt * item.quantity - price.amount) / Math.max(price.amount, 1)) : 0.4;
  const belowBonus = dy >= -8 ? 0.08 : 0;
  return verticalScore * 0.35 + horizontalScore * 0.2 + rightBias * 0.15 + qtyScore * 0.3 + belowBonus;
};

export const parseItems = (
  layout: LayoutDocument,
  total: number,
  itemMaxLineIndex: number
): { items: ReceiptItem[]; confidence: number } => {
  const region = layout.lines.filter((line) => line.index < itemMaxLineIndex);
  const itemCandidates: ItemCandidate[] = [];
  const prices: PriceCandidate[] = [];

  for (const [position, line] of region.entries()) {
    const amounts = extractAmounts(line.text);
    const amountOnly =
      amounts.length === 1 &&
      (PRICE_LINE.test(line.text) ||
        line.text.replace(/[0-9.,\s$£€₵GHCSUSDPEARONXTF]/gi, '').trim().length === 0);
    const prev = region[position - 1];
    const tenderContext = [line.text, prev?.text ?? ''].join(' ');
    const isTenderPrice =
      fuzzyHasTerm(tenderContext, PAYMENT_TERMS) ||
      fuzzyHasTerm(tenderContext, CHANGE_TERMS) ||
      isStrongTotalLabel(tenderContext) ||
      fuzzyHasTerm(tenderContext, SUBTOTAL_TERMS) ||
      fuzzyHasTerm(tenderContext, TAX_TERMS);
    const rightPrice = amountOnly && line.rightColumnScore >= 0.4 && !isTenderPrice;
    if (rightPrice) {
      prices.push({ lineIndex: line.index, amount: amounts[0], y: line.centerY, x: line.box.x });
      continue;
    }
    if (amounts.length === 1 && /[ONXTF]\s*$/i.test(line.text) && line.rightColumnScore >= 0.35) {
      prices.push({ lineIndex: line.index, amount: amounts[0], y: line.centerY, x: line.box.x });
      continue;
    }
    if (
      amounts.length >= 1 &&
      /[A-Za-z]{2,}/.test(line.text) &&
      /\d+[.,]\d{2}\s*[ONXTFE0]?\s*$/i.test(line.text) &&
      !QTY_NOTE.test(line.text) &&
      !/@\s*[\d.,]+/.test(line.text) &&
      !/\b(?:lb|1b)\b/i.test(line.text) &&
      !/\d+\s*\/\s*\d+[.,]\d{2}/.test(line.text)
    ) {
      prices.push({
        lineIndex: line.index,
        amount: amounts[amounts.length - 1],
        y: line.centerY,
        x: line.box.x + line.box.width,
      });
    }
    if (!/[a-zA-Z]{2,}/.test(line.text)) continue;
    if (isServiceOrNoise(line.text)) continue;
    if (line.normalizedY < 0.18) continue;
    const parsed = parseQtyAndLabel(line.text);
    if (!parsed.label || parsed.label.length < 2 || parsed.label.length > MAX_ITEM_LABEL_LENGTH) continue;
    if (JUNK_LABEL.test(parsed.label) || isColumnHeaderLabel(parsed.label)) continue;
    if (parsed.quantity > MAX_ITEM_QUANTITY && parsed.unitAt == null) continue;
    itemCandidates.push({
      lineIndex: line.index,
      label: parsed.label,
      quantity: parsed.quantity,
      unitAt: parsed.unitAt,
      y: line.centerY,
      x: line.box.x,
    });
  }

  const usablePrices = keepLineTotalPrices(prices, layout.width);
  const scoreMatrix = itemCandidates.map((item) =>
    usablePrices.map((price) => pairScore(item, price, layout.width))
  );
  const matches = assignMaxWeight(scoreMatrix, 0.42);
  const resolved: ReceiptItem[] = [];
  let scoreSum = 0;

  for (const match of matches) {
    const item = itemCandidates[match.row];
    const price = usablePrices[match.col];
    const lineTotal = price.amount;
    if (lineTotal <= 0) continue;
    const unitPrice =
      item.unitAt != null && Math.abs(item.unitAt * item.quantity - lineTotal) <= 0.12
        ? item.unitAt
        : Math.round((lineTotal / Math.max(item.quantity, 1)) * 100) / 100;
    resolved.push({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label: item.label,
      quantity: Math.max(1, item.quantity),
      unitPrice: Math.max(0.01, unitPrice),
      total: lineTotal,
      confidence: Math.min(0.99, match.score),
      sourceLineIndex: item.lineIndex,
      sourceBox: layout.lines.find((line) => line.index === item.lineIndex)?.box,
    });
    scoreSum += match.score;
  }

  for (const item of resolved) {
    const origin = itemCandidates.find((candidate) => candidate.label === item.label);
    if (!origin) continue;
    const note = layout.lines.find(
      (line) =>
        line.centerY > origin.y &&
        line.centerY < origin.y + 95 &&
        /(\d+)\s*AT\b/i.test(line.text)
    );
    const match = note?.text.match(/(\d+)\s*AT\b/i);
    if (!match) continue;
    const quantity = Number(match[1]) || item.quantity;
    if (quantity < 2 || quantity > MAX_ITEM_QUANTITY) continue;
    item.quantity = quantity;
    item.unitPrice = Math.round(((item.total ?? item.unitPrice) / quantity) * 100) / 100;
  }

  resolved.sort((a, b) => {
    const ay = itemCandidates.find((candidate) => candidate.label === a.label)?.y ?? 0;
    const by = itemCandidates.find((candidate) => candidate.label === b.label)?.y ?? 0;
    return ay - by;
  });

  // Fallback for lone item matching total (common one-line receipts).
  if (resolved.length === 0 && itemCandidates.length > 0 && total > 0) {
    const first = itemCandidates[0];
    const unitPrice = first.unitAt ?? Math.round((total / Math.max(first.quantity, 1)) * 100) / 100;
    resolved.push({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label: first.label,
      quantity: Math.max(1, first.quantity),
      unitPrice: Math.max(0.01, unitPrice),
      total,
      confidence: 0.55,
    });
    scoreSum = 0.55;
  }

  const cleaned = dropFalseItems(resolved, total);
  const subtotal = cleaned.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);
  const consistency = total > 0 && cleaned.length > 0 ? Math.max(0, 1 - Math.abs(subtotal - total) / Math.max(total, 1)) : 0.4;
  const capped = cleaned.slice(0, MAX_RECEIPT_ITEMS);
  const confidence = capped.length === 0 ? 0.35 : Math.min(0.99, (scoreSum / Math.max(capped.length, 1)) * 0.7 + consistency * 0.3);
  return { items: capped, confidence };
};
