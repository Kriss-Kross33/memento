import Constants from 'expo-constants';
import {
  createPurchasesClient,
  emptyAccess,
  isUserCancelledError,
  type AccessState,
  type PurchasesClient,
  type StoreOffering,
  type StorePlan,
} from '@internal/purchases';
import { ENTITLEMENTS } from '@/constants/monetization';

type Extra = {
  revenueCatIosApiKey?: string;
  revenueCatAndroidApiKey?: string;
  revenueCatProEntitlement?: string;
  revenueCatProPlusEntitlement?: string;
  revenueCatDevUnlock?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const iosApiKey = extra.revenueCatIosApiKey?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const androidApiKey =
  extra.revenueCatAndroidApiKey?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const subscriptionConfig = {
  iosApiKey,
  androidApiKey,
  entitlements: {
    pro: extra.revenueCatProEntitlement?.trim() || ENTITLEMENTS.pro,
    proPlus: extra.revenueCatProPlusEntitlement?.trim() || ENTITLEMENTS.proPlus,
  },
  enabled: Boolean(iosApiKey || androidApiKey),
  fallbackHasPro: __DEV__ && extra.revenueCatDevUnlock === true,
};

let client: PurchasesClient | null = null;
let initialized = false;

const getClient = (): PurchasesClient => {
  if (!client) {
    client = createPurchasesClient(subscriptionConfig);
  }
  return client;
};

export const initializeSubscriptions = async (): Promise<void> => {
  if (initialized) return;
  await getClient().initialize();
  initialized = true;
};

export const getSubscriptionAccess = async (): Promise<AccessState> => {
  try {
    await initializeSubscriptions();
    return await getClient().getAccess();
  } catch (error) {
    console.warn('[subscription] access failed', error);
    return emptyAccess(subscriptionConfig.fallbackHasPro);
  }
};

export const getSubscriptionOfferings = async (): Promise<StoreOffering | null> => {
  try {
    await initializeSubscriptions();
    return await getClient().getOfferings();
  } catch (error) {
    console.warn('[subscription] offerings failed', error);
    return null;
  }
};

export const purchasePlan = async (plan: StorePlan): Promise<AccessState> => {
  await initializeSubscriptions();
  return getClient().purchase(plan);
};

export const restorePurchases = async (): Promise<AccessState> => {
  await initializeSubscriptions();
  return getClient().restorePurchases();
};

export { isUserCancelledError };
export type { AccessState, StoreOffering, StorePlan };
