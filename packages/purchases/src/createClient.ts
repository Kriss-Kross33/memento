import { createPlatformPurchasesClient } from './nativeClient';
import { createStubPurchasesClient } from './stubClient';
import type { PurchasesClient, PurchasesClientConfig } from './types';

export const createPurchasesClient = (config: PurchasesClientConfig): PurchasesClient => {
  if (config.enabled === false) {
    return createStubPurchasesClient(config);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as { Platform?: { OS?: string } };
    if (Platform?.OS === 'web') {
      return createStubPurchasesClient(config);
    }
  } catch {
    return createStubPurchasesClient(config);
  }

  return createPlatformPurchasesClient(config);
};
