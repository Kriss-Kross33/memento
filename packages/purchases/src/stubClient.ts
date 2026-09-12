import { accessFromCustomerInfo, emptyAccess } from './entitlements';
import type { AccessState, PurchasesClient, PurchasesClientConfig, StoreOffering, StorePlan } from './types';

export const createStubPurchasesClient = (config: PurchasesClientConfig): PurchasesClient => {
  let access: AccessState = emptyAccess(config.fallbackHasPro === true);

  return {
    async initialize() {
      access = emptyAccess(config.fallbackHasPro === true);
    },
    async getAccess() {
      return access;
    },
    async getOfferings(): Promise<StoreOffering | null> {
      return null;
    },
    async purchase(_plan: StorePlan): Promise<AccessState> {
      throw new Error('purchases-unavailable');
    },
    async restorePurchases(): Promise<AccessState> {
      return accessFromCustomerInfo(null, config.entitlements, config.fallbackHasPro === true);
    },
  };
};
