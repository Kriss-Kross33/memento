import type { LayoutDocument } from '@/utils/receipt/types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, dct: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalIso = (year: number, month: number, day: number): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const parseDateFromText = (text: string): string | null => {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return toLocalIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) return toLocalIso(year, day, month);
    return toLocalIso(year, month, day);
  }

  const named = text.match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2}|\d{2})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2}|\d{2})\b/
  );
  if (named) {
    if (named[1] && named[2] && named[3]) {
      const month = MONTHS[named[2].toLowerCase()];
      if (month) {
        let year = Number(named[3]);
        if (year < 100) year += 2000;
        return toLocalIso(year, month, Number(named[1]));
      }
    }
    if (named[4] && named[5] && named[6]) {
      const month = MONTHS[named[4].toLowerCase()];
      if (month) {
        let year = Number(named[6]);
        if (year < 100) year += 2000;
        return toLocalIso(year, month, Number(named[5]));
      }
    }
  }

  const compactNamed = text.match(
    /\b(\d{1,2})\s*([A-Za-z]{3,9})(?:['’.]|\b)\s*['’]?\s*(\d{2}|20\d{2})\b/
  );
  if (compactNamed) {
    const month = MONTHS[compactNamed[2].toLowerCase()];
    if (month) {
      let year = Number(compactNamed[3]);
      if (year < 100) year += 2000;
      return toLocalIso(year, month, Number(compactNamed[1]));
    }
  }
  return null;
};

export const pickDateCandidate = (layout: LayoutDocument, fallback: string) => {
  for (const line of layout.lines) {
    const date = parseDateFromText(line.text);
    if (date) {
      const topBoost = line.normalizedY <= 0.6 ? 0.15 : 0;
      return { value: date, confidence: Math.min(0.98, 0.78 + topBoost), source: line.text };
    }
  }
  return { value: fallback, confidence: 0.5, source: 'fallback' };
};
