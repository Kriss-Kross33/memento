import type { PlanKind, StoreOffering, StorePlan } from '@internal/purchases';

export const FREE_OCR_SCANS_PER_MONTH = 10;

export const ENTITLEMENTS = {
  pro: 'pro',
  proPlus: 'pro_plus',
} as const;

export const FALLBACK_PRICES: Record<PlanKind, { priceString: string; price: number }> = {
  monthly: { priceString: '$2.99', price: 2.99 },
  yearly: { priceString: '$19.99', price: 19.99 },
  lifetime: { priceString: '$34.99', price: 34.99 },
};

export const PLAN_COPY: Record<
  PlanKind,
  { title: string; cadence: string; valueNote: string }
> = {
  monthly: {
    title: 'Monthly',
    cadence: 'per month',
    valueNote: 'Flexible. Cancel anytime.',
  },
  yearly: {
    title: 'Yearly',
    cadence: 'per year',
    valueNote: 'Best value — about two months free.',
  },
  lifetime: {
    title: 'Lifetime',
    cadence: 'one payment',
    valueNote: 'All current Pro features. One payment. No subscription.',
  },
};

export const PRO_FEATURES = [
  'Unlimited on-device OCR scans',
  'Advanced receipt parsing and item extraction',
  'Smart categorization and tags',
  'Custom categories',
  'PDF and batch export',
  'Warranty and return tracking',
  'Advanced insights and organization',
] as const;

export const fallbackOffering = (): StoreOffering => ({
  identifier: 'default',
  plans: (['monthly', 'yearly', 'lifetime'] as const).map((kind) => ({
    kind,
    identifier: kind,
    packageIdentifier: kind,
    productIdentifier: kind,
    priceString: FALLBACK_PRICES[kind].priceString,
    price: FALLBACK_PRICES[kind].price,
    hasIntroOffer: false,
  })),
});

export const mergeOffering = (offering: StoreOffering | null): StoreOffering => {
  if (!offering || offering.plans.length === 0) return fallbackOffering();
  const byKind = new Map(offering.plans.map((plan) => [plan.kind, plan]));
  return {
    identifier: offering.identifier,
    plans: fallbackOffering().plans.map((fallback) => {
      const live = byKind.get(fallback.kind);
      return live ?? fallback;
    }),
  };
};

export const recommendedPlan = (offering: StoreOffering): StorePlan =>
  offering.plans.find((plan) => plan.kind === 'yearly') ??
  offering.plans.find((plan) => plan.kind === 'lifetime') ??
  offering.plans[0];
