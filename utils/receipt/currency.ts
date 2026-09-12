import type { Currency } from '@/utils/currency';
import type { LayoutDocument } from '@/utils/receipt/types';

export const pickCurrencyCandidate = (layout: LayoutDocument, merchant: string, fallback: Currency) => {
  const text = `${merchant}\n${layout.lines.map((line) => line.text).join('\n')}`;
  if (/GH₵|GHC|\bGHS\b|\bcedi|\b₵|\bghana\b|\becg\b|electricity company/i.test(text)) {
    return { value: 'GHS' as Currency, confidence: 0.92, source: 'ghana-markers' };
  }
  if (/\bSGD\b|\bS\$|gst\s*reg|\bsingapore\b|pte\.?\s*ltd/i.test(text)) {
    return { value: 'SGD' as Currency, confidence: 0.9, source: 'sg-markers' };
  }
  if (/€|\bEUR\b|\beuro/i.test(text)) return { value: 'EUR' as Currency, confidence: 0.88, source: 'eur-marker' };
  if (/£|\bGBP\b|\bpound/i.test(text)) return { value: 'GBP' as Currency, confidence: 0.88, source: 'gbp-marker' };
  if (
    /\$|\bUSD\b|\bdollar|\bus\s*debit\b|\bwalmart\b|\bnashville\b|gallatin\s+tn\b/i.test(text)
  ) {
    return { value: 'USD' as Currency, confidence: 0.86, source: 'usd-marker' };
  }
  return { value: fallback, confidence: 0.6, source: 'fallback' };
};

export const guessCategoryCandidate = (text: string, merchant: string, categoryHint?: string) => {
  if (categoryHint) return { value: categoryHint, confidence: 0.9, source: 'merchant-profile' };
  const haystack = `${merchant} ${text}`;
  const hints: Array<{ value: string; pattern: RegExp }> = [
    { value: 'Food & Dining', pattern: /\b(restaurant|cafe|coffee|bakery|pizza|burger|kfc|food|dining|bar|grill|kitchen)\b/i },
    { value: 'Groceries', pattern: /\b(walmart|grocery|supermarket|kroger|tesco)\b/i },
    { value: 'Transportation', pattern: /\b(uber|bolt|taxi|fuel|petrol|diesel|shell|goil|station)\b/i },
    { value: 'Travel', pattern: /\b(airline|airways|hotel|booking|flight)\b/i },
    { value: 'Utilities', pattern: /\b(electric|water|ecg|internet|wifi|airtime|mtn|telecel|airteltigo)\b/i },
    { value: 'Software & Tools', pattern: /\b(aws|github|figma|adobe|subscription)\b/i },
  ];
  for (const hint of hints) {
    if (hint.pattern.test(haystack)) return { value: hint.value, confidence: 0.82, source: hint.pattern.source };
  }
  return { value: 'Other', confidence: 0.5, source: 'fallback' };
};
