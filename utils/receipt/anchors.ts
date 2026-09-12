import type { Anchor, LayoutDocument } from '@/utils/receipt/types';
import {
  fuzzyHasTerm,
  SUBTOTAL_TERMS,
  TAX_TERMS,
  TOTAL_TERMS,
  PAYMENT_TERMS,
  CHANGE_TERMS,
} from '@/utils/receipt/vocabulary';
import { parseDateFromText } from '@/utils/receipt/date';

export const findAnchors = (layout: LayoutDocument): Anchor[] => {
  const anchors: Anchor[] = [];
  for (const line of layout.lines) {
    const text = line.text;
    if (fuzzyHasTerm(text, SUBTOTAL_TERMS, 0.8)) anchors.push({ role: 'subtotal', lineIndex: line.index, confidence: 0.9 });
    if (
      fuzzyHasTerm(text, TOTAL_TERMS, 0.82) &&
      !fuzzyHasTerm(text, SUBTOTAL_TERMS, 0.8) &&
      !/total\s*item\s*sold/i.test(text)
    ) {
      anchors.push({ role: 'total', lineIndex: line.index, confidence: 0.94 });
    }
    if (fuzzyHasTerm(text, TAX_TERMS, 0.8)) anchors.push({ role: 'tax', lineIndex: line.index, confidence: 0.85 });
    if (fuzzyHasTerm(text, PAYMENT_TERMS, 0.8)) anchors.push({ role: 'payment', lineIndex: line.index, confidence: 0.8 });
    if (fuzzyHasTerm(text, CHANGE_TERMS, 0.82)) anchors.push({ role: 'change', lineIndex: line.index, confidence: 0.9 });
    if (parseDateFromText(text)) anchors.push({ role: 'date', lineIndex: line.index, confidence: 0.8 });
  }
  return anchors;
};

export const deriveRegions = (layout: LayoutDocument, anchors: Anchor[]) => {
  const totalAnchors = anchors.filter((a) => a.role === 'total');
  const firstTotal = totalAnchors[0]?.lineIndex ?? Infinity;
  const lastTotal = totalAnchors[totalAnchors.length - 1]?.lineIndex ?? firstTotal;
  const subtotalY = anchors.find((a) => a.role === 'subtotal')?.lineIndex ?? firstTotal;
  const paymentY = anchors.find((a) => a.role === 'payment')?.lineIndex ?? lastTotal + 2;
  const changeY = anchors.find((a) => a.role === 'change')?.lineIndex ?? lastTotal;

  const itemRegionMax = Number.isFinite(firstTotal) ? firstTotal : Math.floor(layout.lines.length * 0.72);
  const totalsMin = Math.min(subtotalY, firstTotal);
  const totalsMax = Math.max(lastTotal, paymentY, changeY);

  return {
    itemMaxLineIndex: itemRegionMax,
    totalsMinLineIndex: Number.isFinite(totalsMin) ? totalsMin : Math.floor(layout.lines.length * 0.65),
    totalsMaxLineIndex: Number.isFinite(totalsMax) ? totalsMax : layout.lines.length + 1,
  };
};
