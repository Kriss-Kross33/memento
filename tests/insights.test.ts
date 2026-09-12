import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Receipt } from '../models/types.ts';
import {
  computeMonthlyInsights,
  currencyTrend,
  pickDisplayCurrency,
  sortCurrencyTotals,
  totalsByCurrency,
  weeklySpend,
} from '../utils/insights.ts';

const receipt = (partial: Partial<Receipt> & Pick<Receipt, 'amount' | 'currency' | 'date'>): Receipt => ({
  id: partial.id ?? `${partial.currency}-${partial.amount}-${partial.date}`,
  merchant: partial.merchant ?? 'Store',
  category: partial.category ?? 'Groceries',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...partial,
});

const september = new Date(2026, 8, 15);

test('totalsByCurrency never adds USD into GHS', () => {
  const totals = totalsByCurrency([
    receipt({ amount: 100, currency: 'GHS', date: '2026-09-02' }),
    receipt({ amount: 290.87, currency: 'USD', date: '2026-09-03' }),
    receipt({ amount: 50, currency: 'GHS', date: '2026-09-04' }),
  ]);
  assert.deepEqual(
    totals.map((entry) => ({ currency: entry.currency, total: entry.total, count: entry.count })),
    [
      { currency: 'USD', total: 290.87, count: 1 },
      { currency: 'GHS', total: 150, count: 2 },
    ]
  );
});

test('monthly insights stay inside the selected currency', () => {
  const receipts = [
    receipt({
      merchant: 'KFC',
      category: 'Dining',
      amount: 80,
      currency: 'GHS',
      date: '2026-09-02',
    }),
    receipt({
      merchant: 'Walmart',
      category: 'Groceries',
      amount: 290.87,
      currency: 'USD',
      date: '2026-09-03',
    }),
  ];
  const ghs = computeMonthlyInsights(receipts, september, 'GHS');
  const usd = computeMonthlyInsights(receipts, september, 'USD');
  assert.equal(ghs.total, 80);
  assert.equal(ghs.count, 1);
  assert.equal(ghs.largest?.merchant, 'KFC');
  assert.equal(usd.total, 290.87);
  assert.equal(usd.count, 1);
  assert.equal(usd.largest?.merchant, 'Walmart');
});

test('weekly spend ignores other currencies', () => {
  const bars = weeklySpend(
    [
      receipt({ amount: 20, currency: 'GHS', date: '2026-09-03' }),
      receipt({ amount: 290.87, currency: 'USD', date: '2026-09-03' }),
      receipt({ amount: 40, currency: 'GHS', date: '2026-09-18' }),
    ],
    'GHS',
    september
  );
  assert.equal(bars[0].total, 20);
  assert.equal(bars[2].total, 40);
  assert.equal(bars.reduce((sum, bar) => sum + bar.total, 0), 60);
});

test('trend compares the same currency only', () => {
  const trend = currencyTrend(
    [
      receipt({ amount: 100, currency: 'GHS', date: '2026-08-10' }),
      receipt({ amount: 40, currency: 'GHS', date: '2026-09-10' }),
      receipt({ amount: 999, currency: 'USD', date: '2026-08-10' }),
      receipt({ amount: 10, currency: 'USD', date: '2026-09-10' }),
    ],
    'GHS',
    september
  );
  assert.equal(trend.previous, 100);
  assert.equal(trend.current, 40);
  assert.equal(trend.percent, -60);
});

test('pickDisplayCurrency prefers the default when it has spend', () => {
  const totals = totalsByCurrency([
    receipt({ amount: 10, currency: 'GHS', date: '2026-09-01' }),
    receipt({ amount: 200, currency: 'USD', date: '2026-09-01' }),
  ]);
  assert.equal(pickDisplayCurrency(totals, 'GHS'), 'GHS');
  assert.equal(sortCurrencyTotals(totals, 'GHS')[0].currency, 'GHS');
});
