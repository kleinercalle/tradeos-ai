import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadEntries, newEntry, saveEntries } from '@/lib/journal';

const TIMEFRAMES = ['Daily', '1H', '15M', '1M'] as const;
const BIASES = ['Bullish', 'Bearish', 'Neutral'] as const;
const POIS = ['FVG', 'Order Block', 'Liquidity', 'Breaker', 'OTE', 'Premium/Discount'] as const;

type Bias = (typeof BIASES)[number];

interface TfState {
  bias: Bias | null;
  pois: string[];
  imageUri: string | null;
  notes: string;
}

const emptyTf = (): TfState => ({ bias: null, pois: [], imageUri: null, notes: '' });

function synthesize(states: TfState[]): string {
  const counts: Record<Bias, number> = { Bullish: 0, Bearish: 0, Neutral: 0 };
  states.forEach((s) => {
    if (s.bias) counts[s.bias] += 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [top, topN] = entries[0];
  const [, secondN] = entries[1];
  const aligned = top !== 'Neutral' && topN > secondN;
  return (
    `${top} (${topN}/4 timeframes)` +
    (aligned
      ? ' — HTF and LTF agree, A+ setup territory'
      : ' — mixed read, wait for alignment or reduce size')
  );
}

export default function AnalyzeScreen() {
  const theme = useTheme();
  const [step, setStep] = useState(0); // 0..3 timeframes, 4 = review
  const [states, setStates] = useState<TfState[]>(() => TIMEFRAMES.map(emptyTf));
  const [saved, setSaved] = useState(false);

  const tf = TIMEFRAMES[step];
  const cur: TfState = states[step] ?? emptyTf();

  const patch = (p: Partial<TfState>) => {
    setStates((prev) => prev.map((s, i) => (i === step ? { ...s, ...p } : s)));
    setSaved(false);
  };

  const togglePoi = (poi: string) => {
    patch({ pois: cur.pois.includes(poi) ? cur.pois.filter((x) => x !== poi) : [...cur.pois, poi] });
  };

  const attachImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) patch({ imageUri: res.assets[0].uri });
  };

  const onSaveToJournal = async () => {
    const biasLine = synthesize(states);
    const detail = TIMEFRAMES.map(
      (t, i) =>
        `${t}: ${states[i].bias ?? '—'}${states[i].pois.length ? ` (${states[i].pois.join(', ')})` : ''}`,
    ).join('\n');
    const existing = await loadEntries();
    await saveEntries([
      newEntry({
        symbol: 'ES',
        notes: `ICT analysis — ${biasLine}\n${detail}\n${states.map((s) => s.notes).filter(Boolean).join(' | ')}`,
        timeframeBias: biasLine,
      }),
      ...existing,
    ]);
    setSaved(true);
  };

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? theme.text : theme.backgroundElement,
  });
  const chipText = (active: boolean) => ({
    color: active ? theme.background : theme.text,
  });

  if (step === TIMEFRAMES.length) {
    const biasLine = synthesize(states);
    return (
      <Screen>
        <ThemedText type="subtitle">Review</ThemedText>
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">SYNTHESIS</ThemedText>
          <ThemedText type="smallBold">{biasLine}</ThemedText>
          {TIMEFRAMES.map((t, i) => (
            <ThemedText key={t} type="small" themeColor="textSecondary">
              {t}: {states[i].bias ?? 'not set'}
              {states[i].pois.length ? ` · ${states[i].pois.join(', ')}` : ''}
              {states[i].imageUri ? ' · 📷' : ''}
            </ThemedText>
          ))}
        </ThemedView>
        <Pressable
          onPress={onSaveToJournal}
          style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {saved ? '✓ Saved to journal' : 'Save to journal'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setStep(0)}>
          <ThemedText type="linkPrimary" style={styles.center}>
            Back to timeframes
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          MVP note: guided checklist + deterministic synthesis. AI vision on
          screenshots lands in M2.
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        STEP {step + 1} / {TIMEFRAMES.length}
      </ThemedText>
      <ThemedText type="subtitle">{tf} chart</ThemedText>

      <ThemedText type="smallBold">Bias</ThemedText>
      <ThemedView style={styles.chips}>
        {BIASES.map((b) => (
          <Pressable key={b} onPress={() => patch({ bias: b })} style={[styles.chip, chipStyle(cur.bias === b)]}>
            <ThemedText type="smallBold" style={chipText(cur.bias === b)}>
              {b === 'Bullish' ? '▲ ' : b === 'Bearish' ? '▼ ' : '• '}
              {b}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedText type="smallBold">Points of interest</ThemedText>
      <ThemedView style={styles.chips}>
        {POIS.map((p) => (
          <Pressable
            key={p}
            onPress={() => togglePoi(p)}
            style={[styles.chip, chipStyle(cur.pois.includes(p))]}>
            <ThemedText type="smallBold" style={chipText(cur.pois.includes(p))}>
              {p}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedText type="smallBold">Screenshot</ThemedText>
      {cur.imageUri ? (
        <Image source={{ uri: cur.imageUri }} style={styles.thumb} />
      ) : null}
      <Pressable
        onPress={attachImage}
        style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          {cur.imageUri ? 'Replace screenshot' : '📷 Attach chart screenshot'}
        </ThemedText>
      </Pressable>

      <ThemedText type="smallBold">Notes</ThemedText>
      <TextInput
        value={cur.notes}
        onChangeText={(v) => patch({ notes: v })}
        placeholder="Displacement, market structure shift…"
        multiline
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.notes,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      />

      <ThemedView style={styles.nav}>
        {step > 0 && (
          <Pressable onPress={() => setStep(step - 1)} style={styles.navBtn}>
            <ThemedText type="linkPrimary">← Back</ThemedText>
          </Pressable>
        )}
        <Pressable
          onPress={() => setStep(step + 1)}
          style={[styles.button, styles.navBtn, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {step === TIMEFRAMES.length - 1 ? 'Review →' : 'Next →'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  thumb: { width: '100%', height: 200, borderRadius: Spacing.three, resizeMode: 'cover' },
  notes: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  navBtn: { flex: 1 },
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  center: { textAlign: 'center' },
});
