import type { CategoryMemory, MerchantProfile } from '@/models/intelligence';
import {
  CATEGORY_MEMORY_KEY,
  rememberCategoryCorrection,
  suggestCategoryForMerchant,
} from '@/services/intelligence/categoryLearning';
import {
  MERCHANT_MEMORY_KEY,
  rememberMerchantCorrection,
  resolveStoredMerchant,
} from '@/services/intelligence/merchantMemory';

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const storage = await import('@react-native-async-storage/async-storage');
    const raw = await storage.default.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  try {
    const storage = await import('@react-native-async-storage/async-storage');
    await storage.default.setItem(key, JSON.stringify(value));
  } catch {
    // Local memory is optional; scanning still works without it.
  }
};

export const loadMerchantProfiles = (): Promise<MerchantProfile[]> =>
  readJson<MerchantProfile[]>(MERCHANT_MEMORY_KEY, []);

export const loadCategoryMemory = (): Promise<CategoryMemory[]> =>
  readJson<CategoryMemory[]>(CATEGORY_MEMORY_KEY, []);

export const recordUserCorrections = async (input: {
  scannedMerchant?: string;
  savedMerchant: string;
  scannedCategory?: string;
  savedCategory: string;
  currency?: string;
}): Promise<void> => {
  const scanned = input.scannedMerchant?.trim();
  const saved = input.savedMerchant.trim();
  if (scanned && saved && scanned !== saved) {
    const profiles = await loadMerchantProfiles();
    await writeJson(
      MERCHANT_MEMORY_KEY,
      rememberMerchantCorrection(profiles, scanned, saved, {
        category: input.savedCategory,
        currency: input.currency,
      })
    );
  }
  if (saved && input.savedCategory && input.savedCategory !== (input.scannedCategory ?? '')) {
    const memory = await loadCategoryMemory();
    await writeJson(CATEGORY_MEMORY_KEY, rememberCategoryCorrection(memory, saved, input.savedCategory));
  }
};

export const applyLocalIntelligence = async <
  T extends {
    merchant: { value: string; confidence: number; source?: string };
    category: { value: string; confidence: number; source?: string };
    currency: { value: string; confidence: number; source?: string };
  },
>(
  parsed: T
): Promise<T> => {
  const [profiles, categories] = await Promise.all([loadMerchantProfiles(), loadCategoryMemory()]);
  const merchantHit = resolveStoredMerchant(parsed.merchant.value, profiles);
  let next = parsed;
  if (merchantHit && merchantHit.confidence >= 0.8 && merchantHit.name !== parsed.merchant.value) {
    next = {
      ...next,
      merchant: {
        ...next.merchant,
        value: merchantHit.name,
        confidence: Math.max(next.merchant.confidence, merchantHit.confidence),
        source: 'merchant-memory',
      },
    };
    if (merchantHit.profile.defaultCurrency && next.currency.confidence < 0.8) {
      next = {
        ...next,
        currency: {
          ...next.currency,
          value: merchantHit.profile.defaultCurrency as T['currency']['value'],
          confidence: Math.max(next.currency.confidence, 0.78),
          source: 'merchant-memory',
        },
      };
    }
  }
  if (next.category.confidence < 0.85) {
    const categoryHit = suggestCategoryForMerchant(next.merchant.value, categories);
    if (categoryHit) {
      next = {
        ...next,
        category: {
          ...next.category,
          value: categoryHit.category,
          confidence: Math.max(next.category.confidence, categoryHit.confidence),
          source: 'category-memory',
        },
      };
    }
  }
  return next;
};
