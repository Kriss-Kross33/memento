export type Currency = 'GHS' | 'USD' | 'GBP' | 'EUR' | 'SGD' | 'CAD' | 'AUD' | 'NZD';

export interface CurrencyMeta {
  code: Currency;
  symbol: string;
  label: string;
}

export const currencies: CurrencyMeta[] = [
  { code: 'GHS', symbol: 'GH₵', label: 'Ghanaian Cedi' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar' },
];

export const DEFAULT_CURRENCY: Currency = 'GHS';

export const currencySymbol = (code: Currency): string => {
  return currencies.find((c) => c.code === code)?.symbol ?? code;
};

export const isCurrency = (value: unknown): value is Currency => {
  return typeof value === 'string' && currencies.some((c) => c.code === value);
};

/**
 * Locale-aware amount formatting with an explicit currency symbol prefix.
 * Digits and grouping come from Intl; the symbol is applied manually so
 * currencies like GHS render as "GH₵" consistently across platforms.
 */
export const formatMoney = (amount: number, code: Currency = DEFAULT_CURRENCY): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const digits = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${currencySymbol(code)}${digits}`;
};

/** Short form for compact contexts (e.g. trend rows). */
export const formatMoneyShort = (amount: number, code: Currency = DEFAULT_CURRENCY): string => {
  const abs = Math.abs(amount);
  if (abs >= 100000) {
    return `${currencySymbol(code)}${new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)}`;
  }
  return formatMoney(amount, code);
};
