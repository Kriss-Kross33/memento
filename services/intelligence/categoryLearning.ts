import type { CategoryMemory } from '@/models/intelligence';
import { normalizeMerchantKey } from '@/services/intelligence/merchantMemory';

export const CATEGORY_MEMORY_KEY = 'memento_category_memory';

export const rememberCategoryCorrection = (
  memory: CategoryMemory[],
  merchant: string,
  category: string
): CategoryMemory[] => {
  const merchantKey = normalizeMerchantKey(merchant);
  const nextCategory = category.trim();
  if (!merchantKey || !nextCategory) return memory;
  const existing = memory.find((entry) => entry.merchantKey === merchantKey);
  if (!existing) {
    return [
      ...memory,
      {
        merchantKey,
        category: nextCategory,
        hits: 1,
        confidence: 0.62,
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  const same = existing.category === nextCategory;
  return memory.map((entry) =>
    entry === existing
      ? {
          merchantKey,
          category: nextCategory,
          hits: same ? existing.hits + 1 : 1,
          confidence: same ? Math.min(0.94, existing.confidence + 0.1) : 0.64,
          updatedAt: new Date().toISOString(),
        }
      : entry
  );
};

export const suggestCategoryForMerchant = (
  merchant: string,
  memory: CategoryMemory[]
): { category: string; confidence: number } | null => {
  const merchantKey = normalizeMerchantKey(merchant);
  const entry = memory.find((item) => item.merchantKey === merchantKey);
  if (!entry || entry.hits < 2 || entry.confidence < 0.7) return null;
  return { category: entry.category, confidence: entry.confidence };
};
