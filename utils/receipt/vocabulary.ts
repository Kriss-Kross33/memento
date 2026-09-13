/**
 * OCR normalization layer — not the parser's primary intelligence.
 * Semantic matching happens after this, then geometry and context.
 */
export const OCR_WORD_FIXES: [RegExp, string][] = [
  [/\breveipt\b/gi, 'Receipt'],
  [/\bpald\b/gi, 'Paid'],
  [/\bchargcd\b/gi, 'Charged'],
  [/\banount\b/gi, 'Amount'],
  [/\banoumt\b/gi, 'Amount'],
  [/\bauount\b/gi, 'Amount'],
  [/\blncluslvo\b/gi, 'Inclusive'],
  [/\bexclus\b/gi, 'Exclusive'],
  [/\bpakd\b/gi, 'Paid'],
  [/\blovy\b/gi, 'Levy'],
  [/\bbalunce\b/gi, 'Balance'],
  [/\bdale\b/gi, 'Date'],
  [/\bcompanny\b/gi, 'Company'],
  [/\botghana\b/gi, 'Of Ghana'],
  [/\bfron\b/gi, 'from'],
  [/\bcasi\b/gi, 'Cash'],
  [/\bdistriot\b/gi, 'District'],
  [/\bdistriet\b/gi, 'District'],
  [/\bpay\s*nent\b/gi, 'Payment'],
  [/\bcodc\b/gi, 'code'],
  [/\bve\s+lcome\b/gi, 'Welcome'],
  [/\btotgl\b/gi, 'Total'],
  [/total\s+die\b/gi, 'Total Due'],
  [/(\d+\s*%\s*)at\b/gi, '$1VAT'],
  [/\bdct\b/gi, 'Oct'],
  [/\bchinatohn\b/gi, 'Chinatown'],
  [/\b(?:dr|or)\s+hing\b/gi, 'DR WING'],
  [/\bhgmt\b/gi, 'MGMT'],
  [/\bpie\s+lid\b/gi, 'PTE LTD'],
  [/\bcrieck\b/gi, 'Check'],
  [/\bwnlmar\s*t\b/gi, 'Walmart'],
  [/\bthank\s+youl\b/gi, 'Thank you'],
  [/walmart\s*>/gi, 'Walmart'],
];

const OCR_TOKEN_CORRECTIONS: Record<string, string> = {
  totgl: 'total',
  anount: 'amount',
  balunce: 'balance',
  casi: 'cash',
  pald: 'paid',
  crieck: 'check',
  criek: 'check',
  dct: 'oct',
};

export const TOTAL_TERMS = [
  'grand total',
  'amount due',
  'total due',
  'net payable',
  'amount paid',
  'total purchase',
  'tax inclusive amount',
  'inclusive amount',
  'balance',
  'total',
];
export const SUBTOTAL_TERMS = ['subtotal', 'sub total', 'sub-total', 'tax exclusive amount', 'exclusive amount'];
export const TAX_TERMS = ['tax', 'vat', 'gst', 'nhil', 'levy', 'getfund', 'get fund', 'service charge'];
export const DISCOUNT_TERMS = ['discount', 'promo', 'promotion', 'coupon', 'savings', 'loyalty', 'store credit', 'voucher'];
export const PAYMENT_TERMS = ['payment', 'cash', 'card', 'visa', 'mastercard', 'momo', 'tendered'];
export const CHANGE_TERMS = ['change', 'change due'];
export const SERVICE_TERMS = ['eat in', 'dine in', 'takeaway', 'take away'];
export const HEADER_NOISE_TERMS = [
  'welcome',
  'store',
  'order',
  'check',
  'chk',
  'cashier',
  'counter',
  'print',
  'visit',
  'www',
  'http',
  'phone',
  'customer copy',
  'thank you',
  'feedback',
  'survey',
];

export const COLUMN_HEADER_TERMS = ['item', 'items', 'qty', 'quantity', 'price', 'amount', 'ghs', 'ghc'];

export const isColumnHeaderLabel = (text: string): boolean => {
  const value = text.replace(/[().:]/g, '').trim();
  if (!value) return false;
  if (/^(item|items|qty|quantity|price|amount|total|ghs|ghc|usd|sgd|gbp|eur)$/i.test(value)) return true;
  return /^(ghs|ghc)\)?$/i.test(value);
};

export const isSloganLike = (text: string): boolean => {
  const words = text.trim().split(/\s+/);
  return (
    words.length >= 6 ||
    /\?/.test(text) ||
    /want chop|where from|all pizza|thank you for/i.test(text)
  );
};

export type TermMatchMethod = 'exact' | 'correction' | 'fuzzy';

export type TermMatch = {
  term: string;
  method: TermMatchMethod;
  score: number;
};

const TERM_THRESHOLDS: Record<string, number> = {
  total: 0.84,
  'grand total': 0.84,
  'amount due': 0.84,
  'total due': 0.84,
  'net payable': 0.84,
  subtotal: 0.84,
  'sub total': 0.84,
  tax: 0.9,
  vat: 0.9,
  gst: 0.9,
  cash: 0.88,
  card: 0.88,
  change: 0.86,
};

export const termThreshold = (term: string): number => {
  const key = normalize(term);
  if (TERM_THRESHOLDS[key] != null) return TERM_THRESHOLDS[key];
  const length = key.replace(/\s/g, '').length;
  if (length <= 3) return 0.9;
  if (length === 4) return 0.88;
  return 0.82;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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

export const similarity = (a: string, b: string): number => {
  const na = normalize(a);
  const nb = normalize(b);
  const max = Math.max(na.length, nb.length);
  if (max === 0) return 1;
  return 1 - levenshtein(na, nb) / max;
};

const correctToken = (token: string): string => OCR_TOKEN_CORRECTIONS[token] ?? token;

const windowMatches = (tokens: string[], termTokens: string[]): boolean => {
  if (termTokens.length === 0) return false;
  for (let i = 0; i <= tokens.length - termTokens.length; i++) {
    if (termTokens.every((term, offset) => tokens[i + offset] === term)) {
      if (termTokens[0] === 'total' && tokens[i - 1] === 'sub') continue;
      return true;
    }
  }
  return false;
};

/** Staged match: exact → common OCR correction → fuzzy with term-specific thresholds. */
export const matchTerms = (text: string, terms: string[]): TermMatch | null => {
  const value = normalize(text);
  if (!value) return null;
  const rawTokens = value.split(' ').filter(Boolean);
  const correctedTokens = rawTokens.map(correctToken);
  const correctedValue = correctedTokens.join(' ');

  let best: TermMatch | null = null;
  const consider = (match: TermMatch) => {
    if (!best || match.score > best.score || (match.score === best.score && match.method !== 'fuzzy')) {
      best = match;
    }
  };

  for (const term of terms) {
    const termNorm = normalize(term);
    const termTokens = termNorm.split(' ').filter(Boolean);
    const threshold = termThreshold(termNorm);

    const exactRaw =
      termTokens.length > 1 ? value.includes(termNorm) || windowMatches(rawTokens, termTokens) : windowMatches(rawTokens, termTokens);
    if (exactRaw) {
      consider({ term: termNorm, method: 'exact', score: 1 });
      continue;
    }
    const exactCorrected =
      termTokens.length > 1
        ? correctedValue.includes(termNorm) || windowMatches(correctedTokens, termTokens)
        : windowMatches(correctedTokens, termTokens);
    if (exactCorrected) {
      consider({ term: termNorm, method: 'correction', score: 0.96 });
      continue;
    }

    const whole = Math.max(similarity(value, termNorm), similarity(correctedValue, termNorm));
    if (whole >= threshold) {
      consider({ term: termNorm, method: 'fuzzy', score: whole });
      continue;
    }
    const tokenScore = Math.max(
      ...rawTokens.map((token) => (token === 'subtotal' ? 0 : similarity(token, termNorm))),
      ...correctedTokens.map((token) => (token === 'subtotal' ? 0 : similarity(token, termNorm))),
      0
    );
    if (tokenScore >= threshold) {
      consider({ term: termNorm, method: 'fuzzy', score: tokenScore });
    }
  }

  return best;
};

export const fuzzyHasTerm = (text: string, terms: string[], threshold?: number): boolean => {
  const match = matchTerms(text, terms);
  if (!match) return false;
  if (threshold != null && match.score < threshold) return false;
  return true;
};

/** Counts / tax / discount "totals" are not the payable receipt total. */
export const isNonPayableTotal = (text: string): boolean =>
  /\btotal\s*(items?|qty|quantity|sold|tax|vat|discount|savings?|tender)\b/i.test(text) ||
  isTaxExclusiveSubtotal(text);

export const isTaxInclusiveTotal = (text: string): boolean =>
  /tax\s*inclus|inclus(?:ive|lvo)\s*a[muo]ount/i.test(text);

export const isTaxExclusiveSubtotal = (text: string): boolean =>
  /tax\s*exclus|exclus(?:ive|\.)\s*a[muo]ount/i.test(text);

export const isTaxInvoiceHeader = (text: string): boolean => /\btax\s*invoice\b/i.test(text);

/**
 * A payable TOTAL label. Fuzzy-only "total" is not enough — short OCR
 * garbage must not become the receipt total by itself.
 */
export const isStrongTotalLabel = (text: string): boolean => {
  if (isNonPayableTotal(text)) return false;
  const match = matchTerms(text, TOTAL_TERMS);
  if (!match) return false;
  if (match.term === 'total' && match.method === 'fuzzy') return false;
  return true;
};

export const totalLabelRank = (text: string): number => {
  if (!isStrongTotalLabel(text)) return 0;
  const value = normalize(text);
  if (value.includes('grand total')) return 100;
  if (isTaxInclusiveTotal(text) || /(tax inclusive|inclusive amount)/.test(value)) return 96;
  if (/(amount due|total due|balance due)/.test(value)) return 92;
  if (/(net payable|amount payable)/.test(value)) return 88;
  if (/(total purchase|amount paid)/.test(value)) return 72;
  return 50;
};

export const sanitizeOcrText = (text: string): string => {
  let next = text.replace(/(\d)\.\(/g, '$1.').replace(/(\d)[oO](\d)/g, '$10$2');
  for (const [from, to] of OCR_WORD_FIXES) next = next.replace(from, to);
  return next.replace(/\s+/g, ' ').trim();
};

export const estimateOcrConfidence = (text: string): number => {
  if (!text) return 0;
  const weird = (text.match(/[^a-zA-Z0-9.,:%$#£€₵/()\-\s@']/g) ?? []).length;
  return Math.max(0.35, 1 - weird / text.length);
};
