export type MerchantProfile = {
  canonicalName: string;
  aliases: string[];
  normalizedAliases: string[];
  defaultCategory?: string;
  country?: string;
  defaultCurrency?: string;
  learnedPatterns: string[];
  confidence: number;
  updatedAt: string;
};

export type CategoryMemory = {
  merchantKey: string;
  category: string;
  hits: number;
  confidence: number;
  updatedAt: string;
};

export type DuplicateMatch = {
  receiptId: string;
  score: number;
  reasons: string[];
};

/**
 * Future on-device semantic model. Complements OCR — it does not replace it.
 * OCR answers "what text is visible?"; this answers "what does it mean?"
 */
export type OnDeviceSemanticModel = {
  classifyDocument?(text: string): Promise<{ type: string; confidence: number } | null>;
  normalizeMerchant?(raw: string): Promise<string | null>;
  normalizeItem?(label: string): Promise<string | null>;
  scoreDuplicate?(left: unknown, right: unknown): Promise<number | null>;
};

export const SEMANTIC_MODEL_UNAVAILABLE: OnDeviceSemanticModel = {};
