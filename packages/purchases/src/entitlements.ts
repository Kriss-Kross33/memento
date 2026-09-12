import type {
  AccessState,
  CustomerEntitlementLike,
  CustomerInfoLike,
  EntitlementMap,
} from './types';

export const emptyAccess = (fallbackHasPro = false): AccessState => ({
  hasPro: fallbackHasPro,
  hasProPlus: false,
  isLifetime: false,
  activeEntitlementIds: fallbackHasPro ? ['pro'] : [],
});

export const isLifetimeEntitlement = (entitlement?: CustomerEntitlementLike): boolean => {
  if (!entitlement) return false;
  if (/lifetime/i.test(entitlement.productIdentifier ?? '')) return true;
  return entitlement.expirationDate == null;
};

export const hasActiveEntitlement = (
  info: CustomerInfoLike | null | undefined,
  entitlementId: string | undefined
): boolean => {
  if (!info || !entitlementId) return false;
  return Boolean(info.entitlements.active[entitlementId]);
};

export const accessFromCustomerInfo = (
  info: CustomerInfoLike | null | undefined,
  entitlements: EntitlementMap,
  fallbackHasPro = false
): AccessState => {
  if (!info) return emptyAccess(fallbackHasPro);

  const pro = info.entitlements.active[entitlements.pro];
  const proPlus = entitlements.proPlus ? info.entitlements.active[entitlements.proPlus] : undefined;
  const activeEntitlementIds = Object.keys(info.entitlements.active);
  const primary = proPlus ?? pro ?? Object.values(info.entitlements.active)[0];

  return {
    hasPro: Boolean(pro) || Boolean(proPlus) || fallbackHasPro,
    hasProPlus: Boolean(proPlus),
    isLifetime: isLifetimeEntitlement(pro) || isLifetimeEntitlement(proPlus),
    activeEntitlementIds,
    productIdentifier: primary?.productIdentifier,
    expirationDate: primary?.expirationDate ?? null,
    periodType: primary?.periodType,
    willRenew: primary?.willRenew,
  };
};
