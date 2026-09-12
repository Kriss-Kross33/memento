import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-receipts');
const dumps = readdirSync(join(root, 'ocr-dumps')).filter((file) => file.endsWith('.json'));
const expected = new Set(readdirSync(join(root, 'expected')).filter((file) => file.endsWith('.json')));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

const index = {
  generatedAt: new Date().toISOString(),
  taxonomy: manifest.taxonomy,
  receipts: dumps.map((file) => {
    const id = file.replace(/\.json$/, '');
    const meta = manifest.receipts?.[id] ?? {};
    return {
      id,
      dump: `ocr-dumps/${file}`,
      expected: expected.has(file) ? `expected/${file}` : null,
      region: meta.region ?? null,
      venue: meta.venue ?? null,
      conditions: meta.conditions ?? [],
    };
  }),
};

writeFileSync(join(root, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${index.receipts.length} corpus entries`);
