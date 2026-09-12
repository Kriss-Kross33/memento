export type {
  AccessState,
  CustomerEntitlementLike,
  CustomerInfoLike,
  EntitlementId,
  EntitlementMap,
  PlanKind,
  PurchasesClient,
  PurchasesClientConfig,
  StoreOffering,
  StorePlan,
} from './types';

export {
  accessFromCustomerInfo,
  emptyAccess,
  hasActiveEntitlement,
  isLifetimeEntitlement,
} from './entitlements';

export { storeOfferingFromCurrent, storePlanFromPackage } from './offerings';
export { isUserCancelledError } from './errors';
export { createPurchasesClient } from './createClient';
export { createStubPurchasesClient } from './stubClient';
