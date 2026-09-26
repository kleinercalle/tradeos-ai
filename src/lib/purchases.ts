/**
 * RevenueCat wiring for the Shipaton monetization requirement.
 *
 * Safe to import anywhere: if no API key is configured the module degrades
 * to a local "not configured" state and never throws.
 *
 * Setup: add your RevenueCat *Android* public API key to .env as
 *   EXPO_PUBLIC_REVENUECAT_API_KEY=appl_...   (use the `test_`/`goog_` key)
 * then create an Entitlement id "pro" and an Offering in the RevenueCat dashboard.
 */
import Purchases, { type CustomerInfo, type PurchasesOffering } from 'react-native-purchases';

export type { CustomerInfo, PurchasesOffering };

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? '';
export const PRO_ENTITLEMENT = 'pro';

let configured = false;

export function hasPurchasesKey(): boolean {
  return API_KEY.length > 0;
}

export function purchasesConfigured(): boolean {
  return configured;
}

/** Idempotent. No-ops when the key is missing. */
export async function initPurchases(): Promise<void> {
  if (configured || !hasPurchasesKey()) return;
  try {
    Purchases.configure({ apiKey: API_KEY });
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
