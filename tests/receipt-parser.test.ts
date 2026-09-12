import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReceiptDocument } from '../utils/receipt/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-receipts');
const index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')) as {
  receipts: Array<{ id: string; dump: string; expected: string | null }>;
};

for (const fixture of index.receipts) {
  test(`parse ${fixture.id}`, () => {
    const dump = JSON.parse(readFileSync(join(root, fixture.dump), 'utf8'));
    const parsed = parseReceiptDocument(dump, { date: '2026-09-12', currency: 'GHS' });
    if (!fixture.expected) {
      assert.ok(parsed.overallConfidence >= 0);
      return;
    }
    const expected = JSON.parse(readFileSync(join(root, fixture.expected), 'utf8')) as {
      merchant: string;
      date: string;
      amount: number;
      currency: string;
      items: Array<{ label: string; quantity: number; unitPrice: number; total?: number }>;
    };
    assert.equal(parsed.merchant.value, expected.merchant);
    assert.equal(parsed.date.value, expected.date);
    assert.equal(parsed.amount.value, expected.amount);
    assert.equal(parsed.currency.value, expected.currency);
    assert.equal(parsed.items.value.length, expected.items.length);
    for (const [i, item] of expected.items.entries()) {
      assert.equal(parsed.items.value[i].label, item.label);
      assert.equal(parsed.items.value[i].quantity, item.quantity);
      assert.equal(parsed.items.value[i].unitPrice, item.unitPrice);
      if (item.total != null) {
        assert.equal(parsed.items.value[i].total, item.total);
      }
    }
  });
}
