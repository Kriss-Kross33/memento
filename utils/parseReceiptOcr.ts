import { Currency } from '@/utils/currency';
import type { ReceiptItem } from '@/models/types';
import type { OcrLine, OcrResult } from '@/services/ocr';

export type ParsedReceiptFields = {
  merchant: string;
  date: string;
  amount: number;
  currency: Currency;
  category: string;
  receiptNumber?: string;
  notes?: string;
  items?: ReceiptItem[];
};

const SKIP_MERCHANT =
  /^(receipt|tax\s*invoice|invoice|cash\s*sale|tel|phone|vat|tin|www\.|http|total|subtotal|change|cash|card|thank|welcome|copy|original|duplicate|customer\s*copy)/i;

const OCR_WORD_FIXES: [RegExp, string][] = [
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

const KNOWN_MERCHANTS: { name: string; category: string }[] = [
  { name: 'Electricity Company of Ghana', category: 'Utilities' },
  { name: 'Ghana Water Company', category: 'Utilities' },
  { name: 'KFC Chinatown Point', category: 'Food & Dining' },
];

const sanitizeOcrText = (text: string): string => {
  let next = text.replace(/(\d)\.\(/g, '$1.').replace(/(\d)[oO](\d)/g, '$10$2');
  for (const [from, to] of OCR_WORD_FIXES) {
    next = next.replace(from, to);
  }
  return next.replace(/\s+/g, ' ').trim();
};

const normalizeName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const levenshtein = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
};

const similarity = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
};

const matchKnownMerchant = (raw: string): { name: string; category: string } | null => {
  const normalized = normalizeName(raw);
  if (!normalized) return null;
  let best: { name: string; category: string; score: number } | null = null;
  for (const known of KNOWN_MERCHANTS) {
    const score = similarity(normalized, normalizeName(known.name));
    if (!best || score > best.score) best = { ...known, score };
  }
  return best && best.score >= 0.68 ? best : null;
};

const isEcgReceipt = (text: string): boolean => {
  const haystack = text.toLowerCase();
  return /\bmeter\s*id\b/.test(haystack) && /\baccount\s*no/.test(haystack);
};

const TOTAL_LABEL =
  /\b(grand\s*total|amount\s*(due|paid|charged)|paid\s*amount|charged\s*amount|net\s*(payable|total|amount)|total\s*due|balance\s*due|total)\b/i;
const NOISE_AMOUNT =
  /\b(sub[\s-]*total|tax|vat|nhil|getfund|levy|change|cash|card|tendered|qty|quantity|discount|before\s*balance|current\s*balance|last\s*charge|\d+\s*%\s*(vat|tax|at))\b/i;
const ITEM_STOP =
  /\b(sub[\s-]*tot(?:al|gl)?|total\s*d(?:ue|ie)|change\s*due|amount\s*(?:due|paid)|grand\s*total|tendered)\b|\b(cash|card|visa|mastercard|momo)\b/i;
const ITEM_HEADER =
  /^[^a-zA-Z]*(welcome|store|vat\s*#|order#?|chk|check\b|tel|phone|www|http|visit|cashier|closed|eat\s*in|dine[\s-]*in|take\s*away|takeaway|free\b)/i;
const SERVICE_LINE = /\b(eat\s*in|dine[\s-]*in|take\s*away|takeaway|dine\s*in)\b/i;
const VAT_OR_TAX_LINE = /\b\d+\s*%\s*(vat|tax|at|gst|nhil)|\b(?:vat|tax|gst|nhil)\b/i;
const TOTAL_ITEM_COUNT = /total\s*item\s*sold/i;
const DATE_LABEL = /\b(date|dated|txn\s*date|trans(?:action)?\s*date)\b/i;

const CATEGORY_HINTS: { category: string; pattern: RegExp }[] = [
  { category: 'Food & Dining', pattern: /\b(restaurant|cafe|coffee|bakery|pizza|burger|kfc|food|dining|bar|grill|chop|kitchen)\b/i },
  { category: 'Transportation', pattern: /\b(uber|bolt|taxi|fuel|petrol|diesel|shell|goil|totalenergies|station)\b/i },
  { category: 'Travel', pattern: /\b(airline|airways|hotel|booking|flight)\b/i },
  { category: 'Utilities', pattern: /\b(electric|water|ecg|internet|wifi|airtime|mtn|telecel|airteltigo)\b/i },
  { category: 'Software & Tools', pattern: /\b(aws|github|figma|adobe|subscription)\b/i },
];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, dct: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalIso = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const hasLayout = (lines: OcrLine[]): boolean => {
  const boxed = lines.filter((l) => l.boundingBox.width >= 8 && l.boundingBox.height >= 8);
  if (boxed.length < 3) return false;
  const ys = boxed.map((l) => l.boundingBox.y);
  return Math.max(...ys) - Math.min(...ys) > 40;
};

const pageHeight = (lines: OcrLine[]): number => {
  if (!hasLayout(lines)) return Math.max(lines.length, 1);
  return Math.max(...lines.map((l) => l.boundingBox.y + l.boundingBox.height), 1);
};

const pageWidth = (lines: OcrLine[]): number => {
  if (!hasLayout(lines)) return 1;
  return Math.max(...lines.map((l) => l.boundingBox.x + l.boundingBox.width), 1);
};

const relativeY = (line: OcrLine, index: number, lines: OcrLine[], height: number): number => {
  if (!hasLayout(lines)) return index / Math.max(lines.length - 1, 1);
  return line.boundingBox.y / height;
};

const isPhoneLike = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && !raw.includes('.') && !/[.,]\d{2}\b/.test(raw);
};

/** Ghana receipts mix 12.50, 12,50, 20.0000, 1,250.00, GH₵50, and whole cedis. */
export const parseAmountToken = (raw: string): number | null => {
  if (/^\s*-/.test(raw) || isPhoneLike(raw)) return null;
  let token = raw.replace(/[GH₵$£€]|GHS|USD|GBP|EUR|GHC|cedis?/gi, '').trim();
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
  /(?:GH₵|GHC|GHS|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?\b|\b\d+,\d{2}\b|\b\d+\.\d{1,4}\b/gi;

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
    matches.push(match[0]);
  }
  const fromMoney = matches.map(parseAmountToken).filter((n): n is number => n !== null);
  if (fromMoney.length > 0) return fromMoney;

  if (TOTAL_LABEL.test(line)) {
    const whole = line.match(/\b(\d{1,6})\b/g) ?? [];
    return whole.map(parseAmountToken).filter((n): n is number => n !== null);
  }
  return [];
};

export const parseDateFromText = (text: string): string | null => {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return toLocalIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) return toLocalIso(year, day, month);
    return toLocalIso(year, month, day);
  }

  const named = text.match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/
  );
  if (named) {
    if (named[1] && named[2] && named[3]) {
      const month = MONTHS[named[2].toLowerCase()];
      if (month) return toLocalIso(Number(named[3]), month, Number(named[1]));
    }
    if (named[4] && named[5] && named[6]) {
      const month = MONTHS[named[4].toLowerCase()];
      if (month) return toLocalIso(Number(named[6]), month, Number(named[5]));
    }
  }

  const compactNamed = text.match(
    /\b(\d{1,2})\s*([A-Za-z]{3,9})(?:['’.]|\b)\s*['’]?\s*(\d{2}|20\d{2})\b/
  );
  if (compactNamed) {
    const month = MONTHS[compactNamed[2].toLowerCase()];
    if (month) {
      let year = Number(compactNamed[3]);
      if (year < 100) year += 2000;
      const iso = toLocalIso(year, month, Number(compactNamed[1]));
      if (iso) return iso;
    }
  }
  return null;
};

const findCurrency = (text: string, fallback: Currency): Currency => {
  if (/GH₵|GHC|\bGHS\b|\bcedi|\b₵|\bghana\b|\becg\b|electricity company/i.test(text)) return 'GHS';
  if (/\bSGD\b|\bS\$|gst\s*reg|\bsingapore\b|pte\.?\s*ltd/i.test(text)) return 'SGD';
  if (/€|\bEUR\b|\beuro/i.test(text)) return 'EUR';
  if (/£|\bGBP\b|\bpound/i.test(text)) return 'GBP';
  if (/\$|\bUSD\b|\bdollar/i.test(text)) return 'USD';
  return fallback;
};

const guessCategory = (text: string, merchant: string): string => {
  const haystack = `${merchant} ${text}`;
  for (const hint of CATEGORY_HINTS) {
    if (hint.pattern.test(haystack)) return hint.category;
  }
  return 'Other';
};

const parseReceiptNumber = (text: string, lines: OcrLine[]): string | undefined => {
  const sc = text.match(/\bSC[-–]+\s*[\d\s|]{8,}/i);
  if (sc) {
    const cleaned = sc[0].replace(/\|/g, '1').replace(/\s+/g, '');
    if (cleaned.length >= 8) return cleaned;
  }
  const labeled = text.match(
    /\b(?:receipt|invoice|ref(?:erence)?)\s*(?:no\.?)?\s*[#:.-]*\s*([A-Z0-9][A-Z0-9-]{5,})/i
  );
  if (labeled?.[1]) return labeled[1];

  const check = text.match(/\b(?:chk|check|chek|chck|crieck|criek)\s*[#:]+\s*(\d{3,8})\b/i);
  if (check) return check[1];

  const orderIdx = lines.findIndex((line) => /^order\s*#?\s*$/i.test(line.text));
  const orderNext = orderIdx >= 0 ? lines[orderIdx + 1]?.text.trim() : '';
  if (/^\d{3,8}$/.test(orderNext)) return orderNext;
  return undefined;
};

const pickCustomer = (lines: OcrLine[]): string | undefined => {
  const index = lines.findIndex((line) => /^\s*customer\s*$/i.test(line.text));
  if (index < 0) return undefined;
  const next = lines[index + 1]?.text.replace(/\s+/g, ' ').trim();
  if (!next || next.length < 3 || next.length > 48) return undefined;
  if (!/[a-zA-Z]{2,}/.test(next)) return undefined;
  if (/^(g\.?\s*code|account|meter|digital)/i.test(next)) return undefined;
  return next;
};

const buildNotes = (receiptNumber: string | undefined, customer: string | undefined): string | undefined => {
  const parts = [
    receiptNumber ? `Receipt No. ${receiptNumber}` : '',
    customer ? `Customer: ${customer}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : undefined;
};

const newItemId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const isValidMerchant = (line: string): boolean => {
  const trimmed = line.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  if (SKIP_MERCHANT.test(trimmed)) return false;
  if (/^(store\s*#|gst\s*reg|co\.?\s*reg|check\s*#|crieck\s*#)/i.test(trimmed)) return false;
  if (/\b(pte\.?\s*ltd|pie\s+lid|llc|inc\.?)\b/i.test(trimmed)) return false;
  if (/\b(mgmt|hgmt)\b/i.test(trimmed) && /chicken|company|fried|kentucky/i.test(trimmed)) return false;
  if (parseDateFromText(trimmed)) return false;
  if (isPhoneLike(trimmed)) return false;
  const amounts = extractAmounts(trimmed);
  if (amounts.length > 0 && amounts[0] > 1) return false;
  return true;
};

const pickMerchant = (lines: OcrLine[]): string => {
  const height = pageHeight(lines);
  const topBand = lines.filter((line, i) => relativeY(line, i, lines, height) <= 0.28);
  const candidates = (topBand.length > 0 ? topBand : lines.slice(0, 8)).filter((l) =>
    isValidMerchant(l.text)
  );
  if (candidates.length === 0) return '';
  const branded = candidates.find((line) => /^kfc\b/i.test(line.text.trim()));
  const chosen = branded ?? candidates[0];
  return chosen.text.replace(/\s+/g, ' ').trim();
};

const pickDate = (lines: OcrLine[], fallback: string): string => {
  const labeled = lines.find((l) => DATE_LABEL.test(l.text) && parseDateFromText(l.text));
  if (labeled) return parseDateFromText(labeled.text) ?? fallback;

  const height = pageHeight(lines);
  const topHalf = lines.filter((line, i) => relativeY(line, i, lines, height) <= 0.55);
  for (const line of topHalf) {
    const date = parseDateFromText(line.text);
    if (date) return date;
  }
  for (const line of lines) {
    const date = parseDateFromText(line.text);
    if (date) return date;
  }
  return fallback;
};

const amountsOn = (line: OcrLine): number[] => extractAmounts(line.text);

const pickTotal = (lines: OcrLine[]): number => {
  const height = pageHeight(lines);
  const isNoise = (line: OcrLine) => NOISE_AMOUNT.test(line.text) && !TOTAL_LABEL.test(line.text);

  const totalLines = lines.filter(
    (line, i) =>
      TOTAL_LABEL.test(line.text) &&
      !isNoise(line) &&
      !TOTAL_ITEM_COUNT.test(line.text) &&
      relativeY(line, i, lines, height) >= 0.35
  );

  const tryLine = (line: OcrLine, index: number): number => {
    const own = amountsOn(line);
    if (own.length > 0) return own[own.length - 1];

    const y = relativeY(line, index, lines, height);
    for (let i = 0; i < lines.length; i++) {
      if (i === index) continue;
      if (Math.abs(relativeY(lines[i], i, lines, height) - y) > 0.05) continue;
      const rowAmounts = amountsOn(lines[i]);
      if (rowAmounts.length > 0) return rowAmounts[rowAmounts.length - 1];
    }

    const next = lines[index + 1];
    if (next && Math.abs(relativeY(next, index + 1, lines, height) - y) < 0.08) {
      const nearby = amountsOn(next);
      if (nearby.length > 0) return nearby[nearby.length - 1];
    }
    return 0;
  };

  for (let i = totalLines.length - 1; i >= 0; i--) {
    const line = totalLines[i];
    const index = lines.indexOf(line);
    const value = tryLine(line, index);
    if (value > 0) return value;
  }

  const bottom = lines.filter((line, i) => relativeY(line, i, lines, height) >= 0.55 && !isNoise(line));
  const bottomAmounts = bottom.flatMap(amountsOn);
  if (bottomAmounts.length > 0) return Math.max(...bottomAmounts);

  return 0;
};

const JUNK_ITEM_LABEL =
  /^(at|vat|tax|gst|nhil|levy|%+|order#?|chk|check|cash|card|total|subtotal|change|due|visit|eat\s*in|dine[\s-]*in|take\s*away|takeaway|free)$/i;

const leftoverLetters = (line: OcrLine): string =>
  line.text
    .replace(/(?:GH₵|GHC|GHS|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*/gi, '')
    .replace(/\b\d[\d.,]*\b/g, '')
    .replace(/[^a-zA-Z]+/g, '')
    .trim();

const isAmountOnlyLine = (line: OcrLine): boolean =>
  amountsOn(line).length === 1 && leftoverLetters(line).length === 0;

const isPriceColumnLine = (line: OcrLine, width: number, laidOut: boolean): boolean => {
  if (!isAmountOnlyLine(line)) return false;
  if (!laidOut) return true;
  const mid = line.boundingBox.x + line.boundingBox.width / 2;
  return mid / width >= 0.48;
};

const parseQtyAndLabel = (
  raw: string
): { quantity: number; label: string; unitAt?: number } => {
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
  work = work
    .replace(/(?:GH₵|GHC|GHS|USD|GBP|EUR|[$£€₵])\s*\d[\d.,]*/gi, '')
    .replace(/\b\d+[.,]\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/@\s*$/g, '')
    .trim();

  const spaced = work.match(/^(\d{1,3})\s*(?:x|×)?\s+(.+)$/i);
  if (spaced) {
    const quantity = Number(spaced[1]);
    if (quantity >= 1 && quantity <= 99 && /[a-zA-Z]{2,}/.test(spaced[2])) {
      return { quantity, label: spaced[2].trim(), unitAt };
    }
  }
  const stuck = work.match(/^(\d{1,2})([A-Za-z].+)$/);
  if (stuck) {
    const quantity = Number(stuck[1]);
    if (quantity >= 1 && quantity <= 20 && /[a-zA-Z]{2,}/.test(stuck[2])) {
      return { quantity, label: stuck[2].trim(), unitAt };
    }
  }
  return { quantity: 1, label: work, unitAt };
};

const parseLineItems = (lines: OcrLine[], total: number): ReceiptItem[] | undefined => {
  const height = pageHeight(lines);
  const width = pageWidth(lines);
  const laidOut = hasLayout(lines);
  const stopAt = lines.findIndex(
    (line, i) => ITEM_STOP.test(line.text) && relativeY(line, i, lines, height) >= 0.38
  );
  const region = stopAt >= 0 ? lines.slice(0, stopAt) : lines;
  const maxDy = laidOut ? Math.max(56, height * 0.03) : 1.5;

  const priced = region.map((line, index) => ({ line, index, amounts: amountsOn(line) }));
  const rightPrices = priced.filter(({ line }) => isPriceColumnLine(line, width, laidOut));
  const amountOnly = priced.filter(({ line }) => isAmountOnlyLine(line));
  const prices = rightPrices.length > 0 ? rightPrices : amountOnly;

  const usedPrices = new Set<number>();
  const items: ReceiptItem[] = [];

  for (let i = 0; i < region.length; i++) {
    const line = region[i];
    if (isPriceColumnLine(line, width, laidOut)) continue;
    if (TOTAL_LABEL.test(line.text) || NOISE_AMOUNT.test(line.text) || SKIP_MERCHANT.test(line.text)) continue;
    if (ITEM_HEADER.test(line.text) || SERVICE_LINE.test(line.text) || VAT_OR_TAX_LINE.test(line.text)) continue;
    if (!/[a-zA-Z]{2,}/.test(line.text)) continue;

    const parsed = parseQtyAndLabel(line.text);
    const label = parsed.label.replace(/^[^a-zA-Z0-9]+/, '').trim();
    if (label.length < 2 || label.length > 48) continue;
    if (!/[a-zA-Z]/.test(label)) continue;
    if (JUNK_ITEM_LABEL.test(label) || SERVICE_LINE.test(label) || VAT_OR_TAX_LINE.test(label)) continue;

    let lineTotal: number | null = null;
    let bestDy = Number.POSITIVE_INFINITY;
    let bestPriceIndex = -1;

    for (const price of prices) {
      if (usedPrices.has(price.index)) continue;
      const dy = laidOut
        ? Math.abs(price.line.boundingBox.y - line.boundingBox.y)
        : Math.abs(price.index - i);
      if (dy > maxDy || dy >= bestDy) continue;
      bestDy = dy;
      bestPriceIndex = price.index;
      lineTotal = price.amounts[0];
    }

    if (lineTotal == null) {
      const own = amountsOn(line);
      if (own.length > 0 && parsed.unitAt == null) {
        lineTotal = own[own.length - 1];
      } else if (parsed.unitAt != null) {
        lineTotal = Math.round(parsed.unitAt * parsed.quantity * 100) / 100;
      }
    }

    if (lineTotal == null || lineTotal < 0.5) continue;

    const unitPrice =
      parsed.unitAt != null &&
      Math.abs(parsed.unitAt * parsed.quantity - lineTotal) <= 0.06
        ? parsed.unitAt
        : Math.round((lineTotal / parsed.quantity) * 100) / 100;
    if (unitPrice < 0.5) continue;

    if (bestPriceIndex >= 0) usedPrices.add(bestPriceIndex);
    items.push({
      id: newItemId(),
      label,
      quantity: parsed.quantity,
      unitPrice,
      total: lineTotal,
    });
    if (items.length >= 24) break;
  }

  return items.length > 0 ? items : undefined;
};

/** Prefer the OCR pass with more receipt-like structure. */
export const scoreOcrResult = (result: OcrResult): number => {
  const lines = result.lines.length > 0 ? result.lines : [{ text: result.text, boundingBox: { x: 0, y: 0, width: 0, height: 0 } }];
  const amountHits = lines.filter((l) => extractAmounts(l.text).length > 0).length;
  const dateHits = lines.filter((l) => parseDateFromText(l.text)).length;
  const totalHits = lines.filter((l) => TOTAL_LABEL.test(l.text) && !NOISE_AMOUNT.test(l.text)).length;
  return lines.length + amountHits * 2 + dateHits * 3 + totalHits * 5;
};

export function parseReceiptOcr(
  result: OcrResult,
  fallback: { date: string; currency: Currency }
): ParsedReceiptFields {
  const sourceLines: OcrLine[] =
    result.lines.length > 0
      ? [...result.lines].sort(
          (a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x
        )
      : result.text
          .split(/\n+/)
          .map((text, i) => ({
            text: text.trim(),
            boundingBox: { x: 0, y: i, width: 0, height: 1 },
          }))
          .filter((l) => l.text);

  const lines = sourceLines.map((line) => ({ ...line, text: sanitizeOcrText(line.text) }));
  const fullText = lines.map((line) => line.text).join('\n');

  const rawMerchant = pickMerchant(lines);
  const known = matchKnownMerchant(rawMerchant);
  const merchant = isEcgReceipt(fullText)
    ? 'Electricity Company of Ghana'
    : (known?.name ?? rawMerchant);
  const amount = pickTotal(lines);
  const receiptNumber = parseReceiptNumber(fullText, lines);
  const category = isEcgReceipt(fullText)
    ? 'Utilities'
    : (known?.category ?? guessCategory(fullText, merchant));
  const items =
    amount > 0
      ? parseLineItems(lines, amount) ??
        (isEcgReceipt(fullText)
          ? [{ id: newItemId(), label: 'Prepaid electricity', quantity: 1, unitPrice: amount }]
          : undefined)
      : undefined;

  return {
    merchant,
    date: pickDate(lines, fallback.date),
    amount,
    currency: findCurrency(`${merchant}\n${fullText}`, fallback.currency),
    category,
    receiptNumber,
    notes: buildNotes(receiptNumber, pickCustomer(lines)),
    items,
  };
}
