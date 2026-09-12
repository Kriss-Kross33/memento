import type { PlanKind, StoreOffering, StorePlan } from './types';

type PackageLike = {
  identifier?: string;
  packageType?: string;
  product?: {
    identifier?: string;
    priceString?: string;
    price?: number;
    introPrice?: {
      priceString?: string;
      period?: string;
      periodNumberOfUnits?: number;
      periodUnit?: string;
    } | null;
  };
};

type OfferingLike = {
  identifier?: string;
  availablePackages?: PackageLike[];
  monthly?: PackageLike | null;
  annual?: PackageLike | null;
  lifetime?: PackageLike | null;
};

const kindFromPackage = (pkg: PackageLike): PlanKind | null => {
  const packageType = (pkg.packageType ?? '').toUpperCase();
  if (packageType === 'MONTHLY') return 'monthly';
  if (packageType === 'ANNUAL') return 'yearly';
  if (packageType === 'LIFETIME') return 'lifetime';

  const identifier = `${pkg.identifier ?? ''} ${pkg.product?.identifier ?? ''}`.toLowerCase();
  if (identifier.includes('lifetime') || identifier.includes('$rc_lifetime')) return 'lifetime';
  if (identifier.includes('annual') || identifier.includes('yearly') || identifier.includes('$rc_annual')) {
    return 'yearly';
  }
  if (identifier.includes('month') || identifier.includes('$rc_monthly')) return 'monthly';
  return null;
};

const introFromProduct = (pkg: PackageLike): Pick<StorePlan, 'hasIntroOffer' | 'introPriceString' | 'introPeriod'> => {
  const intro = pkg.product?.introPrice;
  if (!intro) return { hasIntroOffer: false };
  return {
    hasIntroOffer: true,
    introPriceString: intro.priceString,
    introPeriod: intro.period ?? (intro.periodNumberOfUnits && intro.periodUnit
      ? `${intro.periodNumberOfUnits} ${intro.periodUnit.toLowerCase()}`
      : undefined),
  };
};

export const storePlanFromPackage = (pkg: PackageLike): StorePlan | null => {
  const kind = kindFromPackage(pkg);
  if (!kind || !pkg.product) return null;
  return {
    kind,
    identifier: pkg.identifier ?? pkg.product.identifier ?? kind,
    packageIdentifier: pkg.identifier ?? kind,
    productIdentifier: pkg.product.identifier ?? kind,
    priceString: pkg.product.priceString ?? '',
    price: pkg.product.price ?? 0,
    raw: pkg,
    ...introFromProduct(pkg),
  };
};

export const storeOfferingFromCurrent = (offering: OfferingLike | null | undefined): StoreOffering | null => {
  if (!offering) return null;
  const packages = offering.availablePackages?.length
    ? offering.availablePackages
    : [offering.monthly, offering.annual, offering.lifetime].filter(Boolean) as PackageLike[];
  const plans = packages
    .map(storePlanFromPackage)
    .filter((plan): plan is StorePlan => plan != null);
  const unique = new Map<PlanKind, StorePlan>();
  for (const plan of plans) {
    if (!unique.has(plan.kind)) unique.set(plan.kind, plan);
  }
  return {
    identifier: offering.identifier ?? 'default',
    plans: ['monthly', 'yearly', 'lifetime']
      .map((kind) => unique.get(kind as PlanKind))
      .filter((plan): plan is StorePlan => plan != null),
  };
};
