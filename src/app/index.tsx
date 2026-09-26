import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadEntries, summarize, type JournalSummary } from '@/lib/journal';

const CARDS = [
  { href: '/analyze', title: 'ICT Analysis', desc: 'Daily → 1H → 15M → 1M bias flow' },
  { href: '/risk', title: 'Risk Calculator', desc: 'Deterministic futures position sizing' },
  { href: '/journal', title: 'Journal', desc: 'Local-first trade log, no account needed' },
  { href: '/pro', title: 'Go Pro', desc: 'Unlock premium via RevenueCat' },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const [summary, setSummary] = useState<JournalSummary | null>(null);

  useEffect(() => {
    loadEntries().then((e) => setSummary(summarize(e)));
  }, []);

  return (
    <Screen>
      <ThemedText type="title">TRADEOS AI</ThemedText>
      <ThemedText themeColor="textSecondary">
        ICT playbook · deterministic risk · local-first journal
      </ThemedText>

      <ThemedView style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Journal</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summary
            ? `${summary.total} trades · ${summary.closed} closed · ${summary.totalR > 0 ? '+' : ''}${summary.totalR}R · ${summary.winRate}% win`
            : 'loading…'}
        </ThemedText>
      </ThemedView>

      {CARDS.map((c) => (
        <Link key={c.href} href={c.href} asChild>
          <Pressable
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{c.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {c.desc}
            </ThemedText>
          </Pressable>
        </Link>
      ))}

      <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
        v1.0.0 · Shipaton MVP · your data never leaves this device
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  foot: { textAlign: 'center', marginTop: Spacing.two },
});
