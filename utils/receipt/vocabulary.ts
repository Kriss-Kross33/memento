export const OCR_WORD_FIXES: [RegExp, string][] = [
  [/\breveipt\b/gi, 'Receipt'],
  [/\bpald\b/gi, 'Paid'],
  [/\bchargcd\b/gi, 'Charged'],
  [/\banount\b/gi, 'Amount'],
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
];

export const TOTAL_TERMS = ['total', 'grand total', 'amount due', 'amount paid', 'total due'];
export const SUBTOTAL_TERMS = ['subtotal', 'sub total', 'sub-total'];
export const TAX_TERMS = ['tax', 'vat', 'gst', 'nhil', 'levy', 'getfund'];
export const PAYMENT_TERMS = ['payment', 'cash', 'card', 'visa', 'mastercard', 'momo', 'tendered'];
export const CHANGE_TERMS = ['change', 'change due'];
export const SERVICE_TERMS = ['eat in', 'dine in', 'takeaway', 'take away'];
export const HEADER_NOISE_TERMS = [
  'welcome',
  'store',
  'order',
  'check',
  'cashier',
  'counter',
  'print',
  'visit',
  'www',
  'http',
  'phone',
  'customer copy',
];

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

export const fuzzyHasTerm = (text: string, terms: string[], threshold = 0.76): boolean => {
  const value = normalize(text);
  if (!value) return false;
  const tokens = value.split(' ');
  for (const term of terms) {
    if (value.includes(term)) return true;
    const score = similarity(value, term);
    if (score >= threshold) return true;
    if (tokens.some((token) => similarity(token, term) >= threshold)) return true;
  }
  return false;
};

export const sanitizeOcrText = (text: string): string => {
  let next = text.replace(/(\d)\.\(/g, '$1.').replace(/(\d)[oO](\d)/g, '$10$2');
  for (const [from, to] of OCR_WORD_FIXES) next = next.replace(from, to);
  return next.replace(/\s+/g, ' ').trim();
};
