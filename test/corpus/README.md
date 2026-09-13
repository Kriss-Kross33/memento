# Memento document corpus

Real OCR dumps and expected fields live in `/test-receipts` so existing
benchmarks keep working. Organize new fixtures conceptually like this:

```
test/corpus/
  receipt/
    supermarket/
    restaurant/
    fuel/
    pharmacy/
    utility/
    retail/
    thermal/
    long/
    multi-page/
    angled/
    low-light/
    low-resolution/
    damaged/
  documents/
    invoices/
    utility-bills/
    digital-receipts/
```

Each case should record, when known:

- document type
- merchant
- date
- currency
- subtotal
- discount
- taxes
- total
- item list

Add the dump + expected JSON under `test-receipts/`, tag it in
`test-receipts/manifest.json`, then run:

```
npm run corpus:index
npm test
```

Do not rely only on synthetic strings. The unit tests in
`tests/document-intelligence.test.ts` cover classifier and charge
signals; accuracy is still measured on the real dumps.
