export const OVERALL_VERIFY_THRESHOLD = 0.68;
export const FIELD_VERIFY_THRESHOLD = 0.72;
export const ITEM_LOW_THRESHOLD = 0.55;
export const RETRY_CONFIDENCE = 0.55;

export const needsReview = (overall?: number): boolean =>
  typeof overall === 'number' ? overall < OVERALL_VERIFY_THRESHOLD : false;

export const isLowFieldConfidence = (value?: number): boolean =>
  typeof value === 'number' ? value < FIELD_VERIFY_THRESHOLD : false;

export const isLowItemConfidence = (value?: number): boolean =>
  typeof value === 'number' ? value < ITEM_LOW_THRESHOLD : false;
