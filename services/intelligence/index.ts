export { applyLocalIntelligence, recordUserCorrections } from '@/services/intelligence/store';
export { findDuplicateMatches, scoreDuplicate } from '@/services/intelligence/duplicates';
export { getSemanticModel, registerSemanticModel } from '@/services/intelligence/semantic';
export {
  normalizeMerchantKey,
  rememberMerchantCorrection,
  resolveStoredMerchant,
} from '@/services/intelligence/merchantMemory';
export { rememberCategoryCorrection, suggestCategoryForMerchant } from '@/services/intelligence/categoryLearning';
