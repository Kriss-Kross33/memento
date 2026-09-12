export const isUserCancelledError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { userCancelled?: boolean; code?: number | string; message?: string };
  if (candidate.userCancelled === true) return true;
  if (candidate.code === 1 || candidate.code === '1' || candidate.code === 'PURCHASE_CANCELLED') return true;
  return /cancel/i.test(candidate.message ?? '');
};
