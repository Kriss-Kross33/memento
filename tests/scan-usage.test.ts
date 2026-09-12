import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FREE_OCR_SCANS_PER_MONTH } from '../constants/monetization.ts';
import {
  evaluateScanAccess,
  incrementUsage,
  normalizeUsage,
} from '../services/usage/scanPolicy.ts';

test('free users may scan until the monthly limit', () => {
  const now = new Date('2026-09-12T12:00:00');
  const allowed = evaluateScanAccess({
    hasPro: false,
    usage: { period: '2026-09', count: FREE_OCR_SCANS_PER_MONTH - 1 },
    now,
  });
  const blocked = evaluateScanAccess({
    hasPro: false,
    usage: { period: '2026-09', count: FREE_OCR_SCANS_PER_MONTH },
    now,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 1);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.unlimited, false);
});

test('Pro entitlement is unlimited and never blocked by local counts', () => {
  const access = evaluateScanAccess({
    hasPro: true,
    usage: { period: '2026-09', count: 80 },
    now: new Date('2026-09-12T12:00:00'),
  });
  assert.equal(access.allowed, true);
  assert.equal(access.unlimited, true);
});

test('scan count resets when the calendar month changes', () => {
  const nextMonth = new Date('2026-10-01T08:00:00');
  const rolled = normalizeUsage({ period: '2026-09', count: 10 }, nextMonth);
  assert.deepEqual(rolled, { period: '2026-10', count: 0 });
  assert.equal(evaluateScanAccess({ hasPro: false, usage: rolled, now: nextMonth }).allowed, true);
});

test('incrementing usage stays inside the current period', () => {
  const now = new Date('2026-09-12T12:00:00');
  const next = incrementUsage({ period: '2026-08', count: 9 }, now);
  assert.deepEqual(next, { period: '2026-09', count: 1 });
});
