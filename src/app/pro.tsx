import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getCustomerInfoSafe,
  getOfferingsSafe,
  hasPurchasesKey,
  initPurchases,
  isPro,
  type CustomerInfo,
} from '@/lib/purchases';

const FEATURES = [
  'AI screenshot analysis (M2) — ICT vision on your charts',
  'Unlimited journal entries & advanced stats',
  'Multi-timeframe bias history',
  'Priority feature requests',
];

export default function ProScreen() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      await initPurchases();
      if (!hasPurchasesKey()) {
        setReady(true);
        return;
      }
      const [offering, info] = await Promise.all([
        getOfferingsSafe(),
        getCustomerInfoSafe(),
      ]);
      setPackages(offering?.availablePackages ?? []);
      setCustomer(info);
      setReady(true);
    })();
  }, []);

  const buy = async (pkg: PurchasesPackage) => {
    setBusy(true);
    setMsg('');
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setCustomer(customerInfo);
      setMsg(isPro(customerInfo) ? 'Welcome to Pro 🎉' : 'Purchase complete.');
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) setMsg(`Purchase failed: ${err.message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const info = await Purchases.restorePurchases();
      setCustomer(info);
      setMsg(isPro(info) ? 'Pro restored 🎉' : 'No active Pro subscription found.');
    } catch {
      setMsg('Restore failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pro = isPro(customer);

  return (
    <Screen>
      <ThemedText type="subtitle">TRADEOS Pro</ThemedText>

      {pro && (
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">✓ Pro active</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            All premium features unlocked on this device.
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">WHAT YOU GET</ThemedText>
        {FEATURES.map((f) => (
          <ThemedText key={f} type="small">
            • {f}
          </ThemedText>
        ))}
      </ThemedView>

      {!ready && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading store…
        </ThemedText>
      )}

      {ready && !hasPurchasesKey() && (
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Paywall wiring ready</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add your RevenueCat Android public API key as EXPO_PUBLIC_REVENUECAT_API_KEY
            in .env, create the “pro” entitlement + offering in the RevenueCat
            dashboard, and this screen becomes a live paywall. No key = no crash.
          </ThemedText>
        </ThemedView>
      )}

      {ready &&
        hasPurchasesKey() &&
        packages.map((pkg) => (
          <Pressable
            key={pkg.identifier}
            disabled={busy}
            onPress={() => buy(pkg)}
            style={[styles.button, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {pkg.product.title} — {pkg.product.priceString}
            </ThemedText>
          </Pressable>
        ))}

      {ready && hasPurchasesKey() && packages.length === 0 && !pro && (
        <ThemedText type="small" themeColor="textSecondary">
          No offerings found. Create an offering in the RevenueCat dashboard and mark
          it “current”.
        </ThemedText>
      )}

      {ready && hasPurchasesKey() && (
        <Pressable onPress={restore} disabled={busy}>
          <ThemedText type="linkPrimary" style={styles.center}>
            Restore purchases
          </ThemedText>
        </Pressable>
      )}

      {msg ? (
        <ThemedText type="small" style={styles.center}>
          {msg}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Subscriptions are handled by Google Play Billing via RevenueCat. Cancel
        anytime in the Play Store.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  center: { textAlign: 'center' },
});
