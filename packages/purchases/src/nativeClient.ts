import { accessFromCustomerInfo, emptyAccess } from './entitlements';
import { storeOfferingFromCurrent } from './offerings';
import { createStubPurchasesClient } from './stubClient';
import type {
  AccessState,
  CustomerInfoLike,
  PurchasesClient,
  PurchasesClientConfig,
  StoreOffering,
  StorePlan,
} from './types';

type PurchasesModule = {
  default: {
    configure(config: { apiKey: string }): void;
    getCustomerInfo(): Promise<CustomerInfoLike>;
    getOfferings(): Promise<{ current?: unknown }>;
    purchasePackage(pkg: unknown): Promise<{ customerInfo: CustomerInfoLike }>;
    restorePurchases(): Promise<CustomerInfoLike>;
  };
};

const toAccess = (info: CustomerInfoLike | null, config: PurchasesClientConfig): AccessState =>
  accessFromCustomerInfo(info, config.entitlements, config.fallbackHasPro === true);

export const createNativePurchasesClient = (config: PurchasesClientConfig): PurchasesClient => {
  let configured = false;

  const load = async (): Promise<PurchasesModule['default']> => {
    const Purchases = (await import('react-native-purchases')) as PurchasesModule;
    return Purchases.default;
  };

  const apiKeyForPlatform = async (): Promise<string | undefined> => {
    const { Platform } = await import('react-native');
    return Platform.OS === 'ios' ? config.iosApiKey : config.androidApiKey;
  };

  return {
    async initialize() {
      if (config.enabled === false) {
        return;
      }
      const apiKey = await apiKeyForPlatform();
      if (!apiKey) return;
      try {
        const Purchases = await load();
        Purchases.configure({ apiKey });
        configured = true;
      } catch (error) {
        configured = false;
        console.warn('[purchases] native client unavailable', error);
      }
    },
    async getAccess() {
      if (!configured) return emptyAccess(config.fallbackHasPro === true);
      const Purchases = await load();
      const info = await Purchases.getCustomerInfo();
      return toAccess(info, config);
    },
    async getOfferings(): Promise<StoreOffering | null> {
      if (!configured) return null;
      const Purchases = await load();
      const offerings = await Purchases.getOfferings();
      return storeOfferingFromCurrent(offerings.current as Parameters<typeof storeOfferingFromCurrent>[0]);
    },
    async purchase(plan: StorePlan): Promise<AccessState> {
      if (!configured || !plan.raw) {
        throw new Error('purchases-unavailable');
      }
      const Purchases = await load();
      const { customerInfo } = await Purchases.purchasePackage(plan.raw);
      return toAccess(customerInfo, config);
    },
    async restorePurchases(): Promise<AccessState> {
      if (!configured) {
        return emptyAccess(config.fallbackHasPro === true);
      }
      const Purchases = await load();
      const info = await Purchases.restorePurchases();
      return toAccess(info, config);
    },
  };
};

export const createPlatformPurchasesClient = (config: PurchasesClientConfig): PurchasesClient => {
  if (config.enabled === false) {
    return createStubPurchasesClient(config);
  }
  return createNativePurchasesClient(config);
};
