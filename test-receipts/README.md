# Receipt parser corpus

OCR dumps live in `ocr-dumps/`. Expected parsed values live in `expected/`.
Put original photos in `photos/` — they are gitignored.

Refresh the index after adding a fixture:

```
npm run corpus:index
```

Run the parser suite:

```
npm test
```
