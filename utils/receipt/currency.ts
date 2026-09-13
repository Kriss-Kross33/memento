import type { Currency } from '@/utils/currency';
import type { LayoutDocument } from '@/utils/receipt/types';

export type CurrencyResolution = {
  value: Currency;
  confidence: number;
  source: string;
};

const has = (text: string, pattern: RegExp): boolean => pattern.test(text);

/**
 * "$" is ambiguous. Combine symbols, abbreviations, merchant/country
 * context, and the user's default. Never treat a lone dollar sign as USD.
 */
export const resolveCurrency = (
  layout: LayoutDocument,
  merchant: string,
  fallback: Currency,
  history?: { currency?: Currency; locale?: Currency }
): CurrencyResolution => {
  const text = `${merchant}\n${layout.lines.map((line) => line.text).join('\n')}`;
  if (has(text, /GH₵|GHC|\bGHS\b|\bcedi|\b₵|\bghana\b|\becg\b|electricity company/i)) {
    return { value: 'GHS', confidence: 0.92, source: 'ghana-markers' };
  }
  if (has(text, /\bSGD\b|\bS\$|gst\s*reg|\bsingapore\b|pte\.?\s*ltd/i)) {
    return { value: 'SGD', confidence: 0.9, source: 'sg-markers' };
  }
  if (has(text, /€|\bEUR\b|\beuro/i)) return { value: 'EUR', confidence: 0.88, source: 'eur-marker' };
  if (has(text, /£|\bGBP\b|\bpound/i)) return { value: 'GBP', confidence: 0.88, source: 'gbp-marker' };
  if (has(text, /\bCAD\b|\bC\$\b|\bcanada\b|\btoronto\b|\bvancouver\b/i)) {
    return { value: 'CAD', confidence: 0.86, source: 'cad-markers' };
  }
  if (has(text, /\bAUD\b|\bA\$\b|\baustralia\b|\bsydney\b|\bmelbourne\b/i)) {
    return { value: 'AUD', confidence: 0.86, source: 'aud-markers' };
  }
  if (has(text, /\bNZD\b|\bNZ\$\b|\bnew zealand\b|\bauckland\b/i)) {
    return { value: 'NZD', confidence: 0.86, source: 'nzd-markers' };
  }
  if (has(text, /\bUSD\b|\bus\s*debit\b|\bwalmart\b|\bnashville\b|gallatin\s+tn\b|\bunited states\b/i)) {
    return { value: 'USD', confidence: 0.86, source: 'usd-marker' };
  }
  if (history?.currency) {
    return { value: history.currency, confidence: 0.74, source: 'merchant-history' };
  }
  if (has(text, /\$/) ) {
    if (history?.locale && history.locale !== 'USD') {
      return { value: history.locale, confidence: 0.58, source: 'ambiguous-dollar' };
    }
    return { value: fallback, confidence: fallback === 'USD' ? 0.62 : 0.48, source: 'ambiguous-dollar' };
  }
  if (history?.locale) {
    return { value: history.locale, confidence: 0.55, source: 'user-locale' };
  }
  return { value: fallback, confidence: 0.6, source: 'fallback' };
};

/** @deprecated Prefer resolveCurrency — kept for existing imports. */
export const pickCurrencyCandidate = resolveCurrency;

export const guessCategoryCandidate = (text: string, merchant: string, categoryHint?: string) => {
  if (categoryHint) return { value: categoryHint, confidence: 0.9, source: 'merchant-profile' };
  const haystack = `${merchant} ${text}`;
  const hints: Array<{ value: string; pattern: RegExp }> = [
    { value: 'Food & Dining', pattern: /\b(restaurant|cafe|coffee|bakery|pizza|burger|kfc|chicken|food|dining|bar|grill|kitchen)\b/i },
    { value: 'Groceries', pattern: /\b(walmart|grocery|supermarket|kroger|tesco|melcom)\b/i },
    { value: 'Transportation', pattern: /\b(uber|bolt|taxi|fuel|petrol|diesel|shell|goil|station)\b/i },
    { value: 'Travel', pattern: /\b(airline|airways|hotel|booking|flight)\b/i },
    { value: 'Utilities', pattern: /\b(electric|water|ecg|internet|wifi|airtime|mtn|telecel|airteltigo)\b/i },
    { value: 'Software & Tools', pattern: /\b(aws|github|figma|adobe|subscription)\b/i },
    { value: 'Shopping', pattern: /\b(mall|retail|department store)\b/i },
  ];
  for (const hint of hints) {
    if (hint.pattern.test(haystack)) return { value: hint.value, confidence: 0.82, source: hint.pattern.source };
  }
  return { value: 'Other', confidence: 0.5, source: 'fallback' };
};
