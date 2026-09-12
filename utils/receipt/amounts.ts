import type { LayoutDocument, LayoutLine } from '@/utils/receipt/types';
import { fuzzyHasTerm, SUBTOTAL_TERMS, TAX_TERMS, TOTAL_TERMS, PAYMENT_TERMS, CHANGE_TERMS } from '@/utils/receipt/vocabulary';

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

const isNegativeMatch = (line: string, index: number): boolean => {
  const before = line.slice(Math.max(0, index - 2), index);
  return /-\s*$/.test(before);
};

export const extractAmounts = (line: string): number[] => {
  const matches: string[] = [];
  const pattern = new RegExp(AMOUNT_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (isNegativeMatch(line, match.index)) continue;
    const after = line.slice(match.index + match[0].length, match.index + match[0].length + 3);
    if (/^\s*%/.test(after)) continue;
    matches.push(match[1] ?? match[0]);
  }
  return matches.map(parseAmountToken).filter((n): n is number => n !== null);
};

const isTotalItemSold = (text: string): boolean => /total\s*item\s*sold/i.test(text);

const contextFor = (layout: LayoutDocument, line: LayoutLine, position: number): string => {
  const row = layout.rows.find((entry) => entry.lines.some((item) => item.index === line.index));
  const rowText = row ? row.lines.map((item) => item.text).join(' ') : line.text;
  const prev = layout.lines[position - 1];
  const prevClose =
    prev && Math.abs(prev.centerY - line.centerY) <= Math.max(prev.box.height, line.box.height, 24) * 1.6;
  return prevClose ? `${prev.text} ${rowText}` : rowText;
};

export const extractAmountCandidates = (layout: LayoutDocument) =>
  layout.lines.flatMap((line, position) =>
    extractAmounts(line.text).map((value) => {
      const context = contextFor(layout, line, position);
      const roleScores = {
        itemPrice: line.rightColumnScore * 0.8 + (line.normalizedY < 0.7 ? 0.2 : 0),
        subtotal: fuzzyHasTerm(context, SUBTOTAL_TERMS) ? 0.95 : 0.1,
        tax: fuzzyHasTerm(context, TAX_TERMS) ? 0.95 : 0.1,
        total: fuzzyHasTerm(context, TOTAL_TERMS) && !isTotalItemSold(context) ? 0.95 : 0.1,
        cash: fuzzyHasTerm(context, PAYMENT_TERMS) ? 0.7 : 0.1,
        change: fuzzyHasTerm(context, CHANGE_TERMS) ? 0.95 : 0.05,
        unknown: 0.2,
      };
      const confidence = Math.max(...Object.values(roleScores));
      return {
        value,
        text: context,
        box: line.box,
        lineIndex: line.index,
        roleScores,
        confidence,
      };
    })
  );
