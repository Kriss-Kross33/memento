import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccessState, StoreOffering, StorePlan } from '@internal/purchases';
import { emptyAccess } from '@internal/purchases';
import { mergeOffering } from '@/constants/monetization';
import {
  getSubscriptionAccess,
  getSubscriptionOfferings,
  initializeSubscriptions,
  isUserCancelledError,
  purchasePlan,
  restorePurchases,
} from '@/services/subscription';
import { getScanAccess, recordScanUsage, type ScanAccess } from '@/services/usage/scanUsage';

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [access, setAccess] = useState<AccessState>(emptyAccess());
  const [offering, setOffering] = useState<StoreOffering>(mergeOffering(null));
  const [scanAccess, setScanAccess] = useState<ScanAccess | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    const nextAccess = await getSubscriptionAccess();
    const nextOffering = mergeOffering(await getSubscriptionOfferings());
    const nextScan = await getScanAccess(nextAccess.hasPro);
    setAccess(nextAccess);
    setOffering(nextOffering);
    setScanAccess(nextScan);
    return nextAccess;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initializeSubscriptions();
        if (cancelled) return;
        await refresh();
      } catch (error) {
        console.warn('[subscription] initialize failed', error);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const purchase = useCallback(
    async (plan: StorePlan): Promise<AccessState> => {
      setIsBusy(true);
      try {
        const next = await purchasePlan(plan);
        setAccess(next);
        setScanAccess(await getScanAccess(next.hasPro));
        return next;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const restore = useCallback(async (): Promise<AccessState> => {
    setIsBusy(true);
    try {
      const next = await restorePurchases();
      setAccess(next);
      setScanAccess(await getScanAccess(next.hasPro));
      return next;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const requestScan = useCallback(async (): Promise<boolean> => {
    const next = await getScanAccess(access.hasPro);
    setScanAccess(next);
    return next.allowed;
  }, [access.hasPro]);

  const consumeScan = useCallback(async () => {
    if (access.hasPro) {
      setScanAccess(await getScanAccess(true));
      return;
    }
    await recordScanUsage();
    setScanAccess(await getScanAccess(false));
  }, [access.hasPro]);

  return useMemo(
    () => ({
      isReady,
      isBusy,
      hasPro: access.hasPro,
      hasProPlus: access.hasProPlus,
      isLifetime: access.isLifetime,
      access,
      offering,
      scanAccess,
      refresh,
      purchase,
      restore,
      requestScan,
      consumeScan,
      isUserCancelledError,
    }),
    [
      access,
      consumeScan,
      isBusy,
      isReady,
      offering,
      purchase,
      refresh,
      requestScan,
      restore,
      scanAccess,
    ]
  );
});
