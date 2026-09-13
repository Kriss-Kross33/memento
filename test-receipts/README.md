# Memento receipt corpus

This is the parser benchmark. A fixture is a real OCR dump plus expected fields — not a regex written for yesterday’s failure.

```
test-receipts/
  ocr-dumps/     on-device OCR JSON
  expected/      merchant, date, total, currency, items
  photos/        original images (gitignored)
  manifest.json  region / venue / condition tags
```

Tag new receipts in `manifest.json` using the taxonomy there:

`ghana` `singapore` `united-states` `restaurant` `supermarket` `fuel` `utility` `thermal` `low-light` `angled` `handwritten` `damaged`

Add a dump, an expected file with the same id, then:

```
npm run corpus:index
npm test
```

Do not add a fixture without expected values unless it is an exploratory dump. Accuracy is measured only on receipts that have `expected/`.

See `test/corpus/README.md` for the expanded document taxonomy (invoices,
utility bills, long/multi-page receipts). New dumps still land here.
