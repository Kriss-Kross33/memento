import type { OCRMetadata } from '@/models/types';
import type { ParsedReceipt, ReviewField, ReviewRequirement, ReviewState } from '@/utils/receipt/types';

export const REVIEW_THRESHOLDS = {
  high: 0.9,
  medium: 0.7,
} as const;

export const OVERALL_VERIFY_THRESHOLD = REVIEW_THRESHOLDS.medium;
export const FIELD_VERIFY_THRESHOLD = 0.72;
export const ITEM_LOW_THRESHOLD = 0.55;
export const RETRY_CONFIDENCE = 0.55;

export const CONFIDENCE_WEIGHTS = {
  total: 0.3,
  merchant: 0.2,
  items: 0.2,
  date: 0.15,
  currency: 0.1,
  category: 0.05,
} as const;

export const reviewStateFromOverall = (overall?: number): ReviewState => {
  if (typeof overall !== 'number') return 'low';
  if (overall >= REVIEW_THRESHOLDS.high) return 'high';
  if (overall >= REVIEW_THRESHOLDS.medium) return 'medium';
  return 'low';
};

export const needsReview = (overall?: number): boolean => reviewStateFromOverall(overall) === 'low';

export const isLowFieldConfidence = (value?: number): boolean =>
  typeof value === 'number' ? value < FIELD_VERIFY_THRESHOLD : false;

export const isLowItemConfidence = (value?: number): boolean =>
  typeof value === 'number' ? value < ITEM_LOW_THRESHOLD : false;

export const weightedOverallConfidence = (
  parsed: Omit<ParsedReceipt, 'overallConfidence' | 'validation' | 'reviewState' | 'reviewRequirements'> & {
    validation: { score: number; warnings?: { code: string }[] };
  }
): number => {
  let mixed =
    parsed.amount.confidence * CONFIDENCE_WEIGHTS.total +
    parsed.merchant.confidence * CONFIDENCE_WEIGHTS.merchant +
    parsed.items.confidence * CONFIDENCE_WEIGHTS.items +
    parsed.date.confidence * CONFIDENCE_WEIGHTS.date +
    parsed.currency.confidence * CONFIDENCE_WEIGHTS.currency +
    parsed.category.confidence * CONFIDENCE_WEIGHTS.category;

  mixed *= 0.55 + 0.45 * parsed.validation.score;

  if (parsed.merchant.confidence < 0.35) mixed *= 0.88;
  if (parsed.amount.confidence < 0.35) mixed *= 0.86;
  const warnings = parsed.validation.warnings ?? [];
  if (warnings.some((warning) => warning.code === 'competing-totals' || warning.code === 'payment-as-total' || warning.code === 'tax-as-total')) {
    mixed *= 0.9;
  }

  return Number(Math.max(0, Math.min(0.99, mixed)).toFixed(3));
};

const uncertain = (confidence?: number, empty = false): boolean => empty || isLowFieldConfidence(confidence);

export const buildReviewRequirements = (
  parsed: Pick<ParsedReceipt, 'merchant' | 'date' | 'amount' | 'currency' | 'category' | 'items' | 'validation'>
): ReviewRequirement[] => {
  const requirements: ReviewRequirement[] = [];
  if (uncertain(parsed.merchant.confidence, !parsed.merchant.value.trim())) {
    requirements.push({ field: 'merchant', reason: 'The store name is uncertain.' });
  }
  if (uncertain(parsed.date.confidence, !parsed.date.value.trim())) {
    requirements.push({ field: 'date', reason: 'The date is uncertain.' });
  }
  if (uncertain(parsed.amount.confidence, parsed.amount.value <= 0) || parsed.validation.warnings.some((warning) => warning.code === 'payment-as-total' || warning.code === 'tax-as-total' || warning.code === 'competing-totals')) {
    requirements.push({ field: 'amount', reason: 'The total needs a quick check.' });
  }
  if (uncertain(parsed.currency.confidence)) {
    requirements.push({ field: 'currency', reason: 'The currency may be wrong.' });
  }
  if (uncertain(parsed.category.confidence)) {
    requirements.push({ field: 'category', reason: 'The category is a best guess.' });
  }
  if (
    uncertain(parsed.items.confidence) ||
    parsed.items.value.some((item) => isLowItemConfidence(item.confidence)) ||
    parsed.validation.warnings.some((warning) =>
      warning.code === 'items-exceed-total' || warning.code === 'subtotal-mismatch' || warning.code === 'line-math'
    )
  ) {
    requirements.push({ field: 'items', reason: 'Some line items look uncertain.' });
  }
  return requirements;
};

export const reviewHeadline = (state: ReviewState, requirements: ReviewRequirement[]): string => {
  if (state === 'high') return 'Receipt ready';
  if (state === 'low') return 'Review required';
  if (requirements.length === 0) return 'Receipt ready';
  return `Receipt ready · Check ${requirements.length} ${requirements.length === 1 ? 'detail' : 'details'}`;
};

export const reviewSubtitle = (state: ReviewState, requirements: ReviewRequirement[]): string => {
  if (state === 'high') return 'These details look solid. Save when you are ready.';
  if (state === 'medium') {
    return requirements.length === 1
      ? 'One field needs a quick look. Everything else is ready.'
      : 'A couple of fields need a quick look. Everything else is ready.';
  }
  if (requirements.length === 0) {
    return 'The photo could not be read confidently. Check the details against the receipt.';
  }
  return 'These details could not be recognized confidently. The photo is still the source of truth.';
};

export const attachReview = (
  parsed: Omit<ParsedReceipt, 'overallConfidence' | 'reviewState' | 'reviewRequirements'> & {
    overallConfidence?: number;
  }
): ParsedReceipt => {
  const overallConfidence = parsed.overallConfidence ?? weightedOverallConfidence(parsed);
  const withOverall = { ...parsed, overallConfidence };
  return {
    ...withOverall,
    reviewState: reviewStateFromOverall(overallConfidence),
    reviewRequirements: buildReviewRequirements(withOverall),
  };
};

export const verificationHints = (
  parsed: Pick<ParsedReceipt, 'merchant' | 'date' | 'amount' | 'items' | 'validation'>
): string[] => {
  const hints: string[] = [];
  if (isLowFieldConfidence(parsed.amount.confidence) || parsed.amount.value <= 0) {
    hints.push('Check the total');
  }
  if (isLowFieldConfidence(parsed.merchant.confidence) || !parsed.merchant.value.trim()) {
    hints.push('Check the merchant');
  }
  if (
    isLowFieldConfidence(parsed.items.confidence) ||
    parsed.validation.warnings.some(
      (warning) =>
        warning.code === 'items-exceed-total' || warning.code === 'subtotal-mismatch' || warning.code === 'line-math'
    )
  ) {
    hints.push('Check the item list');
  }
  if (isLowFieldConfidence(parsed.date.confidence) && !hints.includes('Check the merchant')) {
    hints.push('Check the date');
  }
  for (const warning of parsed.validation.warnings) {
    if (hints.length >= 3) break;
    if (warning.code === 'payment-as-total' && !hints.includes('Check the total')) {
      hints.push('Check the total');
    }
  }
  return hints.slice(0, 3);
};

export const requirementsFromOcr = (
  ocr: OCRMetadata | undefined,
  extras?: { merchant?: string; amount?: number; itemCount?: number; date?: string; category?: string; currency?: string }
): ReviewRequirement[] => {
  const requirements: ReviewRequirement[] = [];
  if (uncertain(ocr?.merchantConfidence, !extras?.merchant?.trim())) {
    requirements.push({ field: 'merchant', reason: 'The store name is uncertain.' });
  }
  if (uncertain(ocr?.dateConfidence, extras?.date === '')) {
    requirements.push({ field: 'date', reason: 'The date is uncertain.' });
  }
  if (uncertain(ocr?.totalConfidence, (extras?.amount ?? 1) <= 0)) {
    requirements.push({ field: 'amount', reason: 'The total needs a quick check.' });
  }
  if (uncertain(ocr?.currencyConfidence)) {
    requirements.push({ field: 'currency', reason: 'The currency may be wrong.' });
  }
  if (uncertain(ocr?.categoryConfidence)) {
    requirements.push({ field: 'category', reason: 'The category is a best guess.' });
  }
  if (uncertain(ocr?.itemsConfidence) && ((extras?.itemCount ?? 0) > 0 || isLowFieldConfidence(ocr?.itemsConfidence))) {
    requirements.push({ field: 'items', reason: 'Some line items look uncertain.' });
  }
  return requirements;
};

export const verificationHintsFromOcr = (
  ocr: OCRMetadata | undefined,
  extras?: { merchant?: string; amount?: number; itemCount?: number }
): string[] => {
  return requirementsFromOcr(ocr, extras).map((requirement) => {
    if (requirement.field === 'amount') return 'Check the total';
    if (requirement.field === 'merchant') return 'Check the merchant';
    if (requirement.field === 'items') return 'Check the item list';
    if (requirement.field === 'date') return 'Check the date';
    if (requirement.field === 'category') return 'Check the category';
    return 'Check the currency';
  }).slice(0, 3);
};

export const reviewSummaryFromOcr = (
  ocr: OCRMetadata | undefined,
  extras?: { merchant?: string; amount?: number; itemCount?: number; date?: string; category?: string; currency?: string }
): { state: ReviewState; requirements: ReviewRequirement[]; headline: string; subtitle: string } => {
  const state = reviewStateFromOverall(ocr?.overallConfidence);
  const requirements = state === 'high' ? [] : requirementsFromOcr(ocr, extras);
  return {
    state,
    requirements,
    headline: reviewHeadline(state, requirements),
    subtitle: reviewSubtitle(state, requirements),
  };
};

export type { ReviewField, ReviewRequirement, ReviewState };
