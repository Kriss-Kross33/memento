import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REVIEW_THRESHOLDS,
  attachReview,
  reviewHeadline,
  reviewStateFromOverall,
  weightedOverallConfidence,
} from '../utils/receipt/confidence.ts';
import { validateReceipt } from '../utils/receipt/validate.ts';

const field = <T>(value: T, confidence: number) => ({ value, confidence });

test('review states use centralized thresholds', () => {
  assert.equal(reviewStateFromOverall(0.95), 'high');
  assert.equal(reviewStateFromOverall(REVIEW_THRESHOLDS.high), 'high');
  assert.equal(reviewStateFromOverall(0.8), 'medium');
  assert.equal(reviewStateFromOverall(REVIEW_THRESHOLDS.medium), 'medium');
  assert.equal(reviewStateFromOverall(0.69), 'low');
  assert.equal(reviewStateFromOverall(undefined), 'low');
});

test('medium review headline names only the uncertain details', () => {
  const parsed = attachReview({
    merchant: field('Melcom', 0.96),
    date: field('2026-09-10', 0.94),
    amount: field(200, 0.95),
    currency: field('GHS', 0.92),
    category: field('Food & Dining', 0.4),
    items: field(
      [{ id: '1', label: 'uncertain text', quantity: 2, unitPrice: 10, total: 20, confidence: 0.3 }],
      0.4
    ),
    validation: { isConsistent: true, score: 1, warnings: [] },
    overallConfidence: 0.82,
  });
  assert.equal(parsed.reviewState, 'medium');
  assert.ok(parsed.reviewRequirements.some((requirement) => requirement.field === 'category'));
  assert.ok(parsed.reviewRequirements.some((requirement) => requirement.field === 'items'));
  assert.equal(parsed.reviewRequirements.some((requirement) => requirement.field === 'merchant'), false);
  assert.equal(reviewHeadline(parsed.reviewState, parsed.reviewRequirements), 'Receipt ready · Check 2 details');
});

test('high confidence does not invent review work', () => {
  const parsed = attachReview({
    merchant: field('KFC', 0.97),
    date: field('2026-09-10', 0.96),
    amount: field(28.5, 0.97),
    currency: field('GHS', 0.95),
    category: field('Food & Dining', 0.9),
    items: field([], 0.9),
    validation: { isConsistent: true, score: 1, warnings: [] },
    overallConfidence: 0.94,
  });
  assert.equal(parsed.reviewState, 'high');
  assert.equal(reviewHeadline(parsed.reviewState, parsed.reviewRequirements), 'Receipt ready');
});

test('severe contradictions reduce overall confidence more than a missing category', () => {
  const broken = weightedOverallConfidence({
    merchant: field('Store', 0.95),
    date: field('2026-09-01', 0.94),
    amount: field(20, 0.96),
    currency: field('GHS', 0.95),
    category: field('Other', 0.9),
    items: field(
      [
        { id: '1', label: 'A', quantity: 1, unitPrice: 15, total: 15 },
        { id: '2', label: 'B', quantity: 1, unitPrice: 18, total: 18 },
      ],
      0.8
    ),
    validation: validateReceipt({
      total: 20,
      items: [
        { id: '1', label: 'A', quantity: 1, unitPrice: 15, total: 15 },
        { id: '2', label: 'B', quantity: 1, unitPrice: 18, total: 18 },
      ],
    }),
  });
  const missingCategory = weightedOverallConfidence({
    merchant: field('Store', 0.95),
    date: field('2026-09-01', 0.94),
    amount: field(20, 0.96),
    currency: field('GHS', 0.95),
    category: field('Other', 0.2),
    items: field([], 0.85),
    validation: { isConsistent: true, score: 1, warnings: [] },
  });
  assert.ok(broken < missingCategory);
});

test('validateReceipt flags competing totals and tax mistaken as total', () => {
  const competing = validateReceipt({
    total: 40,
    items: [],
    amounts: [
      {
        value: 40,
        text: '40.00',
        box: { x: 0, y: 0, width: 1, height: 1 },
        lineIndex: 10,
        roleScores: { itemPrice: 0, subtotal: 0, tax: 0, total: 0.9, cash: 0, change: 0, unknown: 0 },
        confidence: 0.9,
      },
      {
        value: 28,
        text: '28.00',
        box: { x: 0, y: 0, width: 1, height: 1 },
        lineIndex: 11,
        roleScores: { itemPrice: 0, subtotal: 0, tax: 0, total: 0.85, cash: 0, change: 0, unknown: 0 },
        confidence: 0.85,
      },
    ],
  });
  assert.ok(competing.warnings.some((warning) => warning.code === 'competing-totals'));

  const taxAsTotal = validateReceipt({
    total: 3.2,
    items: [],
    amounts: [
      {
        value: 3.2,
        text: 'TAX 3.20',
        box: { x: 0, y: 0, width: 1, height: 1 },
        lineIndex: 8,
        roleScores: { itemPrice: 0, subtotal: 0, tax: 0.92, total: 0.2, cash: 0, change: 0, unknown: 0 },
        confidence: 0.8,
      },
    ],
  });
  assert.ok(taxAsTotal.warnings.some((warning) => warning.code === 'tax-as-total'));
  assert.equal(taxAsTotal.isConsistent, false);
});
