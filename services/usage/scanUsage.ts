import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyUsage,
  evaluateScanAccess,
  incrementUsage,
  normalizeUsage,
  type ScanAccess,
  type ScanUsage,
} from '@/services/usage/scanPolicy';

export const SCAN_USAGE_KEY = 'memento_scan_usage';

export type { ScanAccess, ScanUsage };
export { currentUsagePeriod, emptyUsage, evaluateScanAccess, incrementUsage, normalizeUsage } from '@/services/usage/scanPolicy';

export const getScanUsage = async (): Promise<ScanUsage> => {
  try {
    const stored = await AsyncStorage.getItem(SCAN_USAGE_KEY);
    if (!stored) return emptyUsage();
    const parsed = JSON.parse(stored) as Partial<ScanUsage>;
    return normalizeUsage({
      period: typeof parsed.period === 'string' ? parsed.period : '',
      count: typeof parsed.count === 'number' ? parsed.count : 0,
    });
  } catch {
    return emptyUsage();
  }
};

export const getScanAccess = async (hasPro: boolean): Promise<ScanAccess> =>
  evaluateScanAccess({ hasPro, usage: await getScanUsage() });

export const recordScanUsage = async (): Promise<ScanUsage> => {
  const next = incrementUsage(await getScanUsage());
  await AsyncStorage.setItem(SCAN_USAGE_KEY, JSON.stringify(next));
  return next;
};
