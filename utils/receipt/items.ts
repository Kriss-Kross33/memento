import type { ReceiptItem } from '@/models/types';
import type { LayoutDocument } from '@/utils/receipt/types';
import { extractAmounts, parseAmountToken } from '@/utils/receipt/amounts';
import { fuzzyHasTerm, HEADER_NOISE_TERMS, SERVICE_TERMS, TAX_TERMS, TOTAL_TERMS, SUBTOTAL_TERMS, PAYMENT_TERMS, CHANGE_TERMS } from '@/utils/receipt/vocabulary';

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

const cleanLabel = (value: string): string =>
  value
    .replace(/(?:GH₵|GHC|GHS|SGD|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*/gi, '')
    .replace(/\b\d+[.,]\d{2}\b/g, '')
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
  fuzzyHasTerm(text, TOTAL_TERMS, 0.82) ||
  fuzzyHasTerm(text, SUBTOTAL_TERMS, 0.82) ||
  fuzzyHasTerm(text, PAYMENT_TERMS, 0.82) ||
  fuzzyHasTerm(text, CHANGE_TERMS, 0.82) ||
  fuzzyHasTerm(text, HEADER_NOISE_TERMS, 0.82) ||
  /\b(pte\.?\s*ltd|llc|inc\.?|reg\.?\s*no)\b/i.test(text) ||
  /^free\b/i.test(text);

const pairScore = (item: ItemCandidate, price: PriceCandidate, docWidth: number): number => {
  const dy = Math.abs(item.y - price.y);
  if (dy > 72) return 0;
  const verticalScore = Math.max(0, 1 - dy / 72);
  const dx = Math.max(0, price.x - item.x);
  const horizontalScore = Math.min(1, dx / Math.max(docWidth * 0.4, 1));
  const rightBias = Math.min(1, price.x / Math.max(docWidth, 1));
  const qtyScore = item.unitAt ? Math.max(0, 1 - Math.abs(item.unitAt * item.quantity - price.amount) / Math.max(price.amount, 1)) : 0.4;
  return verticalScore * 0.35 + horizontalScore * 0.2 + rightBias * 0.15 + qtyScore * 0.3;
};

export const parseItems = (
  layout: LayoutDocument,
  total: number,
  itemMaxLineIndex: number
): { items: ReceiptItem[]; confidence: number } => {
  const region = layout.lines.filter((line) => line.index <= itemMaxLineIndex);
  const itemCandidates: ItemCandidate[] = [];
  const prices: PriceCandidate[] = [];

  for (const line of region) {
    const amounts = extractAmounts(line.text);
    const amountOnly = amounts.length === 1 && line.text.replace(/[0-9.,\s$£€₵GHCSUSDPEAR]/gi, '').trim().length === 0;
    if (amountOnly) {
      prices.push({ lineIndex: line.index, amount: amounts[0], y: line.centerY, x: line.box.x });
      continue;
    }
    if (!/[a-zA-Z]{2,}/.test(line.text)) continue;
    if (isServiceOrNoise(line.text)) continue;
    if (line.normalizedY < 0.22) continue;
    const parsed = parseQtyAndLabel(line.text);
    if (!parsed.label || parsed.label.length < 2 || parsed.label.length > 56) continue;
    if (parsed.quantity > 30 && parsed.unitAt == null) continue;
    itemCandidates.push({
      lineIndex: line.index,
      label: parsed.label,
      quantity: parsed.quantity,
      unitAt: parsed.unitAt,
      y: line.centerY,
      x: line.box.x,
    });
  }

  const edges = itemCandidates.flatMap((item) =>
    prices.map((price) => ({ item, price, score: pairScore(item, price, layout.width) }))
  )
  .filter((pair) => pair.score >= 0.5)
  .sort((a, b) => b.score - a.score);

  const usedItem = new Set<number>();
  const usedPrice = new Set<number>();
  const resolved: ReceiptItem[] = [];
  let scoreSum = 0;

  for (const edge of edges) {
    if (usedItem.has(edge.item.lineIndex) || usedPrice.has(edge.price.lineIndex)) continue;
    usedItem.add(edge.item.lineIndex);
    usedPrice.add(edge.price.lineIndex);
    const lineTotal = edge.price.amount;
    if (lineTotal <= 0) continue;
    const unitPrice =
      edge.item.unitAt != null && Math.abs(edge.item.unitAt * edge.item.quantity - lineTotal) <= 0.12
        ? edge.item.unitAt
        : Math.round((lineTotal / Math.max(edge.item.quantity, 1)) * 100) / 100;
    resolved.push({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label: edge.item.label,
      quantity: Math.max(1, edge.item.quantity),
      unitPrice: Math.max(0.01, unitPrice),
      total: lineTotal,
      confidence: Math.min(0.99, edge.score),
    });
    scoreSum += edge.score;
  }

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

  const subtotal = resolved.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);
  const consistency = total > 0 && resolved.length > 0 ? Math.max(0, 1 - Math.abs(subtotal - total) / Math.max(total, 1)) : 0.4;
  const confidence = resolved.length === 0 ? 0.35 : Math.min(0.99, (scoreSum / resolved.length) * 0.7 + consistency * 0.3);
  return { items: resolved, confidence };
};
