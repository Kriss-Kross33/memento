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
    if (fuzzyHasTerm(text, TOTAL_TERMS, 0.82) && !/total\s*item\s*sold/i.test(text)) {
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
  const totalY = anchors.find((a) => a.role === 'total')?.lineIndex ?? Infinity;
  const subtotalY = anchors.find((a) => a.role === 'subtotal')?.lineIndex ?? totalY;
  const paymentY = anchors.find((a) => a.role === 'payment')?.lineIndex ?? totalY + 2;

  const itemRegionMax = Number.isFinite(totalY) ? totalY : Math.floor(layout.lines.length * 0.72);
  const totalsMin = Math.min(subtotalY, totalY);
  const totalsMax = Math.max(totalY, paymentY);

  return {
    itemMaxLineIndex: itemRegionMax,
    totalsMinLineIndex: Number.isFinite(totalsMin) ? totalsMin : Math.floor(layout.lines.length * 0.65),
    totalsMaxLineIndex: Number.isFinite(totalsMax) ? totalsMax : layout.lines.length + 1,
  };
};
