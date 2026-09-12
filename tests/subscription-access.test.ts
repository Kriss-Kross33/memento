import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accessFromCustomerInfo,
  hasActiveEntitlement,
  isLifetimeEntitlement,
  storeOfferingFromCurrent,
  isUserCancelledError,
} from '../packages/purchases/src/index.ts';

const entitlements = { pro: 'pro', proPlus: 'pro_plus' };

test('pro entitlement maps monthly and yearly products to hasPro', () => {
  const monthly = accessFromCustomerInfo(
    {
      entitlements: {
        active: {
          pro: {
            identifier: 'pro',
            productIdentifier: 'pro_monthly',
            expirationDate: '2026-10-12T00:00:00Z',
            periodType: 'NORMAL',
            willRenew: true,
          },
        },
      },
    },
    entitlements
  );
  assert.equal(monthly.hasPro, true);
  assert.equal(monthly.hasProPlus, false);
  assert.equal(monthly.isLifetime, false);
  assert.equal(
    hasActiveEntitlement(
      {
        entitlements: {
          active: { pro: { productIdentifier: 'pro_yearly', expirationDate: '2027-09-12' } },
        },
      },
      'pro'
    ),
    true
  );
});

test('lifetime entitlement is Pro and non-expiring', () => {
  const lifetime = accessFromCustomerInfo(
    {
      entitlements: {
        active: {
          pro: {
            identifier: 'pro',
            productIdentifier: 'pro_lifetime',
            expirationDate: null,
            periodType: 'NORMAL',
          },
        },
      },
    },
    entitlements
  );
  assert.equal(lifetime.hasPro, true);
  assert.equal(lifetime.isLifetime, true);
  assert.equal(isLifetimeEntitlement({ productIdentifier: 'pro_lifetime', expirationDate: null }), true);
});

test('restore uses RevenueCat entitlements rather than a local flag', () => {
  const restored = accessFromCustomerInfo(
    {
      entitlements: {
        active: {
          pro: { identifier: 'pro', productIdentifier: 'pro_yearly', expirationDate: '2027-01-01' },
        },
      },
    },
    entitlements
  );
  const empty = accessFromCustomerInfo({ entitlements: { active: {} } }, entitlements);
  assert.equal(restored.hasPro, true);
  assert.equal(empty.hasPro, false);
});

test('offerings map monthly, yearly, and lifetime without product IDs in UI logic', () => {
  const offering = storeOfferingFromCurrent({
    identifier: 'default',
    availablePackages: [
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: 'pro_monthly',
          priceString: '$2.99',
          price: 2.99,
          introPrice: { priceString: '$0.00', period: 'P7D' },
        },
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: { identifier: 'pro_yearly', priceString: '$19.99', price: 19.99 },
      },
      {
        identifier: '$rc_lifetime',
        packageType: 'LIFETIME',
        product: { identifier: 'pro_lifetime', priceString: '$34.99', price: 34.99 },
      },
    ],
  });
  assert.ok(offering);
  assert.deepEqual(
    offering.plans.map((plan) => plan.kind),
    ['monthly', 'yearly', 'lifetime']
  );
  assert.equal(offering.plans[0].hasIntroOffer, true);
  assert.equal(offering.plans[1].hasIntroOffer, false);
});

test('user cancelled purchases are not treated as failures', () => {
  assert.equal(isUserCancelledError({ userCancelled: true }), true);
  assert.equal(isUserCancelledError({ code: 1, message: 'Purchase was cancelled.' }), true);
  assert.equal(isUserCancelledError({ message: 'Network request failed' }), false);
});

test('Pro+ is recognized but not required for current Pro access', () => {
  const plus = accessFromCustomerInfo(
    {
      entitlements: {
        active: {
          pro_plus: { identifier: 'pro_plus', productIdentifier: 'pro_plus_monthly', expirationDate: '2026-10-01' },
        },
      },
    },
    entitlements
  );
  assert.equal(plus.hasProPlus, true);
  assert.equal(plus.hasPro, true);
});
