import type { ParsedReceipt } from '@/utils/receipt/types';
import type { DocumentType } from '@/models/document';

export type CorpusExpectation = {
  documentType?: DocumentType;
  merchant: string;
  date: string;
  currency: string;
  amount: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  items: Array<{ label: string }>;
};

export type BenchmarkScores = {
  documentClassification: number;
  merchant: number;
  date: number;
  currency: number;
  total: number;
  subtotal: number;
  tax: number;
  itemPrecision: number;
  itemRecall: number;
  falseItemRate: number;
  cases: number;
};

const ratio = (hits: number, total: number): number => (total === 0 ? 1 : hits / total);

export const scoreParsedAgainstExpected = (
  parsed: ParsedReceipt,
  expected: CorpusExpectation
): Omit<BenchmarkScores, 'cases'> => {
  const predicted = parsed.items.value.map((item) => item.label.toLowerCase());
  const gold = expected.items.map((item) => item.label.toLowerCase());
  const truePos = gold.filter((label) => predicted.includes(label)).length;
  const falsePos = predicted.filter((label) => !gold.includes(label)).length;
  return {
    documentClassification:
      !expected.documentType || parsed.documentType?.type === expected.documentType ? 1 : 0,
    merchant: parsed.merchant.value === expected.merchant ? 1 : 0,
    date: parsed.date.value === expected.date ? 1 : 0,
    currency: parsed.currency.value === expected.currency ? 1 : 0,
    total: parsed.amount.value === expected.amount ? 1 : 0,
    subtotal: expected.subtotal == null || parsed.subtotal?.value === expected.subtotal ? 1 : 0,
    tax: expected.tax == null || parsed.tax?.value === expected.tax ? 1 : 0,
    itemPrecision: ratio(truePos, predicted.length),
    itemRecall: ratio(truePos, gold.length),
    falseItemRate: ratio(falsePos, predicted.length),
  };
};

export const averageScores = (rows: Array<Omit<BenchmarkScores, 'cases'>>): BenchmarkScores => {
  const cases = rows.length;
  const sum = (key: keyof Omit<BenchmarkScores, 'cases'>): number =>
    cases === 0 ? 0 : rows.reduce((total, row) => total + row[key], 0) / cases;
  return {
    documentClassification: sum('documentClassification'),
    merchant: sum('merchant'),
    date: sum('date'),
    currency: sum('currency'),
    total: sum('total'),
    subtotal: sum('subtotal'),
    tax: sum('tax'),
    itemPrecision: sum('itemPrecision'),
    itemRecall: sum('itemRecall'),
    falseItemRate: sum('falseItemRate'),
    cases,
  };
};
