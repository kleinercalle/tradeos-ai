/**
 * RevenueCat wiring for the Shipaton monetization requirement.
 *
 * Target store: Samsung Galaxy Store (RevenueCat Galaxy support, RN SDK 10.3+).
 * Safe to import anywhere: if no API key is configured the module degrades
 * to a local "not configured" state and never throws.
 *
 * Setup:
 *   1. Create a free RevenueCat account and a project.
 *   2. Add a Galaxy Store app to the project -> copy its public key (galx_...).
 *   3. .env: EXPO_PUBLIC_REVENUECAT_GALAXY_KEY=galx_...
 *   4. In RevenueCat: Entitlement id "pro", add the Galaxy Store subscription
 *      product, create an Offering and mark it current.
 *
 * Purchases are NEVER claimed as operational until a real test purchase
 * succeeds on a physical Galaxy device (Galaxy Store has no emulator billing).
 */
import Purchases, { type CustomerInfo, type PurchasesOffering } from 'react-native-purchases';
import {
  GALAXY_BILLING_MODE,
  type GalaxyBillingMode,
} from 'react-native-purchases-store-galaxy';

export type { CustomerInfo, PurchasesOffering };

const GALAXY_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GALAXY_KEY?.trim() ?? '';
// Legacy Play-Store key path, kept as a fallback (not our target store).
const LEGACY_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? '';
export const PRO_ENTITLEMENT = 'pro';

const useGalaxy = GALAXY_KEY.length > 0;
let configured = false;

export function hasPurchasesKey(): boolean {
  return useGalaxy || LEGACY_KEY.length > 0;
}

export function isGalaxyStore(): boolean {
  return useGalaxy;
}

export function purchasesConfigured(): boolean {
  return configured;
}

/** Idempotent. No-ops when the key is missing. */
export async function initPurchases(): Promise<void> {
  if (configured || !hasPurchasesKey()) return;
  try {
    if (useGalaxy) {
      // TEST billing in dev builds, PRODUCTION in release builds.
      const billingMode: GalaxyBillingMode = __DEV__
        ? GALAXY_BILLING_MODE.TEST
        : GALAXY_BILLING_MODE.PRODUCTION;
      Purchases.configure({
        apiKey: GALAXY_KEY,
        store: 'GALAXY',
        galaxyBillingMode: billingMode,
      });
    } else {
      Purchases.configure({ apiKey: LEGACY_KEY });
    }
    configured = true;
  } catch (e) {
    console.warn('[purchases] configure failed:', e);
  }
}

export async function getOfferingsSafe(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.warn('[purchases] getOfferings failed:', e);
    return null;
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[purchases] getCustomerInfo failed:', e);
    return null;
  }
}

export function isPro(customer: CustomerInfo | null): boolean {
  return !!customer && customer.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}
