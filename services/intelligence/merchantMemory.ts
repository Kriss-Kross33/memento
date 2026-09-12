import type { MerchantProfile } from '@/models/intelligence';

export const MERCHANT_MEMORY_KEY = 'memento_merchant_memory';

export const normalizeMerchantKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const similarity = (a: string, b: string): number => {
  const left = normalizeMerchantKey(a);
  const right = normalizeMerchantKey(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const max = Math.max(left.length, right.length);
  let distance = 0;
  const shortest = Math.min(left.length, right.length);
  for (let i = 0; i < shortest; i++) {
    if (left[i] !== right[i]) distance += 1;
  }
  distance += Math.abs(left.length - right.length);
  return Math.max(0, 1 - distance / max);
};

export const rememberMerchantCorrection = (
  profiles: MerchantProfile[],
  rawName: string,
  canonicalName: string,
  extras?: { category?: string; country?: string; currency?: string }
): MerchantProfile[] => {
  const raw = rawName.trim();
  const canonical = canonicalName.trim();
  if (!raw || !canonical) return profiles;
  const key = normalizeMerchantKey(canonical);
  const aliasKey = normalizeMerchantKey(raw);
  const existing = profiles.find(
    (profile) =>
      normalizeMerchantKey(profile.canonicalName) === key || profile.normalizedAliases.includes(aliasKey)
  );
  if (!existing) {
    return [
      ...profiles,
      {
        canonicalName: canonical,
        aliases: raw !== canonical ? [raw] : [],
        normalizedAliases: [key, aliasKey].filter((value, index, all) => value && all.indexOf(value) === index),
        defaultCategory: extras?.category,
        country: extras?.country,
        defaultCurrency: extras?.currency,
        learnedPatterns: [raw, canonical],
        confidence: 0.72,
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  const aliases = existing.aliases.includes(raw) || raw === existing.canonicalName ? existing.aliases : [...existing.aliases, raw];
  return profiles.map((profile) =>
    profile === existing
      ? {
          ...existing,
          canonicalName: canonical,
          aliases,
          normalizedAliases: [...new Set([...existing.normalizedAliases, aliasKey, key])],
          defaultCategory: extras?.category ?? existing.defaultCategory,
          defaultCurrency: extras?.currency ?? existing.defaultCurrency,
          learnedPatterns: [...new Set([...existing.learnedPatterns, raw, canonical])],
          confidence: Math.min(0.97, existing.confidence + 0.08),
          updatedAt: new Date().toISOString(),
        }
      : profile
  );
};

export const resolveStoredMerchant = (
  rawName: string,
  profiles: MerchantProfile[]
): { name: string; confidence: number; profile: MerchantProfile } | null => {
  const raw = rawName.trim();
  if (!raw) return null;
  const key = normalizeMerchantKey(raw);
  let best: { profile: MerchantProfile; score: number } | null = null;
  for (const profile of profiles) {
    const aliasHit = profile.normalizedAliases.includes(key) || profile.aliases.some((alias) => normalizeMerchantKey(alias) === key);
    const score = aliasHit ? Math.max(0.88, profile.confidence) : similarity(raw, profile.canonicalName);
    if (score >= 0.78 && (!best || score > best.score)) best = { profile, score };
  }
  if (!best) return null;
  return { name: best.profile.canonicalName, confidence: Math.min(0.96, best.score), profile: best.profile };
};
