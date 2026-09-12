import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-receipts');
const dumps = readdirSync(join(root, 'ocr-dumps')).filter((file) => file.endsWith('.json'));
const expected = new Set(readdirSync(join(root, 'expected')).filter((file) => file.endsWith('.json')));

const index = {
  generatedAt: new Date().toISOString(),
  receipts: dumps.map((file) => ({
    id: file.replace(/\.json$/, ''),
    dump: `ocr-dumps/${file}`,
    expected: expected.has(file) ? `expected/${file}` : null,
  })),
};

writeFileSync(join(root, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${index.receipts.length} corpus entries`);
