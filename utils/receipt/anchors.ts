import type { Anchor, LayoutDocument, ReceiptRegions } from '@/utils/receipt/types';
import {
  CHANGE_TERMS,
  PAYMENT_TERMS,
  SUBTOTAL_TERMS,
  TAX_TERMS,
  fuzzyHasTerm,
  isStrongTotalLabel,
  totalLabelRank,
} from '@/utils/receipt/vocabulary';
import { parseDateFromText } from '@/utils/receipt/date';

export const findAnchors = (layout: LayoutDocument): Anchor[] => {
  const anchors: Anchor[] = [];
  for (const line of layout.lines) {
    const text = line.text;
    if (fuzzyHasTerm(text, SUBTOTAL_TERMS)) {
      anchors.push({ role: 'subtotal', lineIndex: line.index, confidence: 0.9, rank: 80 });
    }
    const rank = totalLabelRank(text);
    if (rank > 0 && isStrongTotalLabel(text)) {
      anchors.push({ role: 'total', lineIndex: line.index, confidence: Math.min(0.98, 0.82 + rank / 400), rank });
    }
    if (fuzzyHasTerm(text, TAX_TERMS)) {
      anchors.push({ role: 'tax', lineIndex: line.index, confidence: 0.85, rank: 40 });
    }
    if (fuzzyHasTerm(text, PAYMENT_TERMS)) {
      anchors.push({ role: 'payment', lineIndex: line.index, confidence: 0.8, rank: 30 });
    }
    if (fuzzyHasTerm(text, CHANGE_TERMS)) {
      anchors.push({ role: 'change', lineIndex: line.index, confidence: 0.9, rank: 20 });
    }
    if (parseDateFromText(text)) {
      anchors.push({ role: 'date', lineIndex: line.index, confidence: 0.8, rank: 10 });
    }
  }
  return anchors;
};

export const deriveRegions = (layout: LayoutDocument, anchors: Anchor[]): ReceiptRegions => {
  const payableTotals = anchors
    .filter((anchor) => anchor.role === 'total')
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.lineIndex - b.lineIndex);
  const primaryTotal = payableTotals[0];
  const firstPayable = [...payableTotals].sort((a, b) => a.lineIndex - b.lineIndex)[0];
  const subtotal = anchors.find((anchor) => anchor.role === 'subtotal');
  const payment = anchors.find((anchor) => anchor.role === 'payment');
  const change = anchors.find((anchor) => anchor.role === 'change');

  const itemBoundary =
    [subtotal?.lineIndex, firstPayable?.lineIndex, primaryTotal?.lineIndex].filter(
      (value): value is number => typeof value === 'number'
    )[0] ?? Math.floor(layout.lines.length * 0.72);

  const totalsMin = Math.min(
    subtotal?.lineIndex ?? primaryTotal?.lineIndex ?? itemBoundary,
    primaryTotal?.lineIndex ?? itemBoundary
  );
  const totalsMax = Math.max(
    primaryTotal?.lineIndex ?? itemBoundary,
    firstPayable?.lineIndex ?? itemBoundary,
    payment?.lineIndex ?? itemBoundary,
    change?.lineIndex ?? itemBoundary
  );

  return {
    itemMaxLineIndex: itemBoundary,
    totalsMinLineIndex: Number.isFinite(totalsMin) ? totalsMin : Math.floor(layout.lines.length * 0.65),
    totalsMaxLineIndex: Number.isFinite(totalsMax) ? totalsMax : layout.lines.length + 1,
  };
};
