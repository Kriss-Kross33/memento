import type { LayoutDocument } from '@/utils/receipt/types';
import { extractAmounts } from '@/utils/receipt/amounts';
import { fuzzyHasTerm, HEADER_NOISE_TERMS } from '@/utils/receipt/vocabulary';

const KNOWN_MERCHANTS: { name: string; category: string; pattern?: RegExp }[] = [
  { name: 'Electricity Company of Ghana', category: 'Utilities' },
  { name: 'Ghana Water Company', category: 'Utilities' },
  { name: 'KFC Chinatown Point', category: 'Food & Dining' },
  { name: 'Walmart', category: 'Groceries', pattern: /\bwalmart\b/i },
];

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const levenshtein = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let i = 0; i < cols; i++) dp[0][i] = i;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
};

const similarity = (a: string, b: string): number => {
  const na = normalize(a);
  const nb = normalize(b);
  const max = Math.max(na.length, nb.length);
  if (max === 0) return 1;
  return 1 - levenshtein(na, nb) / max;
};

export const isEcgReceipt = (text: string): boolean => {
  const haystack = text.toLowerCase();
  return /\bmeter\s*id\b/.test(haystack) && /\baccount\s*no\b/.test(haystack);
};

const isValidMerchantLine = (text: string): boolean => {
  const value = text.trim();
  if (value.length < 3 || value.length > 56) return false;
  if (!/[a-zA-Z]/.test(value)) return false;
  if (fuzzyHasTerm(value, HEADER_NOISE_TERMS, 0.84)) return false;
  if (/thank|feedback|survey|\.com|\.cm\b|mgr:|^\d{3}-\d{3}|pike|gallatin|\bst#/i.test(value)) {
    return false;
  }
  if (/^(store|gst|co\.?\s*reg|check|receipt|invoice|cash)/i.test(value)) return false;
  if (/\b(pte\.?\s*ltd|llc|inc\.?)\b/i.test(value)) return false;
  const amounts = extractAmounts(value);
  return amounts.length === 0;
};

export const pickMerchantCandidate = (layout: LayoutDocument) => {
  const top = layout.lines.filter((line) => line.normalizedY <= 0.32);
  const candidates = (top.length > 0 ? top : layout.lines.slice(0, 8)).filter((line) =>
    isValidMerchantLine(line.text)
  );
  const haystack = layout.lines.map((line) => line.text).join('\n');
  for (const merchant of KNOWN_MERCHANTS) {
    if (merchant.pattern?.test(haystack) || similarity(haystack, merchant.name) >= 0.86) {
      const source =
        layout.lines.find((line) => new RegExp(`^${merchant.name}\\b`, 'i').test(line.text.trim())) ??
        layout.lines.find((line) => merchant.pattern?.test(line.text) || similarity(line.text, merchant.name) >= 0.68);
      return {
        value: merchant.name,
        confidence: 0.94,
        categoryHint: merchant.category,
        source: source?.text ?? merchant.name,
        line: source ?? undefined,
      };
    }
  }

  if (candidates.length === 0) {
    return { value: '', confidence: 0.2, categoryHint: undefined, source: 'none', line: undefined };
  }
  const branded = candidates.find((line) => /^(kfc|walmart)\b/i.test(line.text.trim()));
  const chosen = branded ?? candidates[0];

  let matchedCategory: string | undefined;
  let confidence = branded ? 0.9 : 0.72;
  for (const merchant of KNOWN_MERCHANTS) {
    const score = similarity(chosen.text, merchant.name);
    if (score >= 0.68) {
      confidence = Math.max(confidence, Math.min(0.98, score));
      matchedCategory = merchant.category;
      return { value: merchant.name, confidence, categoryHint: matchedCategory, source: chosen.text, line: chosen };
    }
  }
  return {
    value: chosen.text.replace(/\s+/g, ' ').trim(),
    confidence,
    categoryHint: matchedCategory,
    source: chosen.text,
    line: chosen,
  };
};
