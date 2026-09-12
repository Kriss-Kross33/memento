export type EntitlementId = string;

export type EntitlementMap = {
  pro: EntitlementId;
  proPlus?: EntitlementId;
};

export type PurchasesClientConfig = {
  iosApiKey?: string;
  androidApiKey?: string;
  entitlements: EntitlementMap;
  enabled?: boolean;
  fallbackHasPro?: boolean;
};

export type AccessState = {
  hasPro: boolean;
  hasProPlus: boolean;
  isLifetime: boolean;
  activeEntitlementIds: string[];
  productIdentifier?: string;
  expirationDate?: string | null;
  periodType?: string;
  willRenew?: boolean;
};

export type PlanKind = 'monthly' | 'yearly' | 'lifetime';

export type StorePlan = {
  kind: PlanKind;
  identifier: string;
  packageIdentifier: string;
  productIdentifier: string;
  priceString: string;
  price: number;
  hasIntroOffer: boolean;
  introPriceString?: string;
  introPeriod?: string;
  raw?: unknown;
};

export type StoreOffering = {
  identifier: string;
  plans: StorePlan[];
};

export type CustomerEntitlementLike = {
  identifier?: string;
  productIdentifier?: string;
  expirationDate?: string | null;
  periodType?: string;
  willRenew?: boolean;
};

export type CustomerInfoLike = {
  entitlements: {
    active: Record<string, CustomerEntitlementLike>;
  };
};

export interface PurchasesClient {
  initialize(): Promise<void>;
  getAccess(): Promise<AccessState>;
  getOfferings(): Promise<StoreOffering | null>;
  purchase(plan: StorePlan): Promise<AccessState>;
  restorePurchases(): Promise<AccessState>;
}
