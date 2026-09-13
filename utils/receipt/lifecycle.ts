import type { ExplicitReturnPolicy, ExplicitWarranty } from '@/models/document';

const DAYS = /(\d{1,3})\s*(?:day|days)\b/i;
const MONTHS = /(\d{1,2})\s*(?:month|months|mo)\b/i;
const YEARS = /(\d{1,2})\s*(?:year|years|yr)\b/i;

const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const durationDays = (text: string): { days: number; label: string } | null => {
  const days = text.match(DAYS);
  if (days) return { days: Number(days[1]), label: `${days[1]} days` };
  const months = text.match(MONTHS);
  if (months) return { days: Number(months[1]) * 30, label: `${months[1]} months` };
  const years = text.match(YEARS);
  if (years) return { days: Number(years[1]) * 365, label: `${years[1]} years` };
  return null;
};

export const returnWindowDaysFromDuration = (duration?: string): number | undefined => {
  if (!duration) return undefined;
  return durationDays(duration)?.days;
};

export const reminderFireDate = (expiryIso: string, daysBefore: number, now = new Date()): string | null => {
  const expiry = new Date(`${expiryIso}T09:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  expiry.setDate(expiry.getDate() - daysBefore);
  if (expiry.getTime() <= now.getTime()) return null;
  return expiry.toISOString();
};

/** Only extract warranty when the document says so. Never invent a period. */
export const extractExplicitWarranty = (text: string, purchaseDate: string): ExplicitWarranty | undefined => {
  if (!/\bwarrant(?:y|ies)\b/i.test(text)) return undefined;
  const window = text.match(
    /\bwarrant(?:y|ies)\b[^.\n]{0,60}?\b(\d{1,3}\s*(?:days?|months?|mo|years?|yrs?))\b/i
  );
  if (!window?.[1]) return undefined;
  const parsed = durationDays(window[1]);
  if (!parsed) return undefined;
  return {
    startDate: purchaseDate,
    duration: parsed.label,
    expiryDate: addDays(purchaseDate, parsed.days),
    confidence: 0.78,
    source: window[0],
  };
};

/** Only extract a return window when the policy is printed. Never invent one. */
export const extractExplicitReturnPolicy = (
  text: string,
  purchaseDate: string
): ExplicitReturnPolicy | undefined => {
  if (!/\breturn(?:s|able| policy)?\b/i.test(text)) return undefined;
  const window = text.match(
    /\breturn(?:s|able| policy)?\b[^.\n]{0,60}?\b(\d{1,3}\s*(?:days?|months?|mo))\b/i
  );
  if (!window?.[1]) return undefined;
  const parsed = durationDays(window[1]);
  if (!parsed) return undefined;
  return {
    startDate: purchaseDate,
    duration: parsed.label,
    deadline: addDays(purchaseDate, parsed.days),
    policyText: window[0],
    confidence: 0.76,
    source: window[0],
  };
};
