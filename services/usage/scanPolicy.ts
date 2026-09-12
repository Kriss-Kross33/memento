import { FREE_OCR_SCANS_PER_MONTH } from '@/constants/monetization';

export type ScanUsage = {
  period: string;
  count: number;
};

export type ScanAccess = {
  allowed: boolean;
  remaining: number;
  period: string;
  count: number;
  limit: number;
  unlimited: boolean;
};

export const currentUsagePeriod = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export const emptyUsage = (now = new Date()): ScanUsage => ({
  period: currentUsagePeriod(now),
  count: 0,
});

export const normalizeUsage = (usage: ScanUsage | null | undefined, now = new Date()): ScanUsage => {
  const period = currentUsagePeriod(now);
  if (!usage || usage.period !== period) return { period, count: 0 };
  return { period, count: Math.max(0, Math.floor(usage.count)) };
};

export const evaluateScanAccess = ({
  hasPro,
  usage,
  limit = FREE_OCR_SCANS_PER_MONTH,
  now = new Date(),
}: {
  hasPro: boolean;
  usage: ScanUsage | null | undefined;
  limit?: number;
  now?: Date;
}): ScanAccess => {
  const current = normalizeUsage(usage, now);
  if (hasPro) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      period: current.period,
      count: current.count,
      limit,
      unlimited: true,
    };
  }
  const remaining = Math.max(0, limit - current.count);
  return {
    allowed: current.count < limit,
    remaining,
    period: current.period,
    count: current.count,
    limit,
    unlimited: false,
  };
};

export const incrementUsage = (usage: ScanUsage | null | undefined, now = new Date()): ScanUsage => {
  const current = normalizeUsage(usage, now);
  return { period: current.period, count: current.count + 1 };
};
