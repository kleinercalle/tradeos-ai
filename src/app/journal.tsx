import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  loadEntries,
  newEntry,
  saveEntries,
  summarize,
  type JournalEntry,
} from '@/lib/journal';

export default function JournalScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [symbol, setSymbol] = useState('MES');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [contracts, setContracts] = useState('1');
  const [resultR, setResultR] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadEntries().then(setEntries);
  }, []);

  const persist = async (next: JournalEntry[]) => {
    setEntries(next);
    await saveEntries(next);
  };

  const onAdd = async () => {
    if (!symbol.trim()) return;
    const e = newEntry({
      symbol,
      direction,
      entry: parseFloat(entryPrice) || 0,
      stop: parseFloat(stopPrice) || 0,
      contracts: parseInt(contracts, 10) || 0,
      notes,
      ...(resultR.trim() !== '' ? { resultR: parseFloat(resultR) } : {}),
    });
    await persist([e, ...entries]);
    setEntryPrice('');
    setStopPrice('');
    setResultR('');
    setNotes('');
  };

  const onDelete = async (id: string) => {
    await persist(entries.filter((e) => e.id !== id));
  };

  const s = summarize(entries);
  const inputStyle = {
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.backgroundSelected,
  };

  return (
    <Screen>
      <ThemedText type="subtitle">Journal</ThemedText>
      <ThemedView style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          {s.total} trades · {s.closed} closed
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Total {s.totalR > 0 ? '+' : ''}{s.totalR}R · {s.winRate}% win rate
        </ThemedText>
      </ThemedView>

      <ThemedView style={[styles.form, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Log a trade</ThemedText>
        <ThemedView style={styles.row}>
          <TextInput
            value={symbol}
            onChangeText={setSymbol}
            placeholder="Symbol"
            autoCapitalize="characters"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.flex, inputStyle]}
          />
          <Pressable
            onPress={() => setDirection(direction === 'long' ? 'short' : 'long')}
            style={[styles.dir, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">
              {direction === 'long' ? '▲ Long' : '▼ Short'}
            </ThemedText>
          </Pressable>
        </ThemedView>
        <ThemedView style={styles.row}>
          <TextInput
            value={entryPrice}
            onChangeText={setEntryPrice}
            placeholder="Entry"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.flex, inputStyle]}
          />
          <TextInput
            value={stopPrice}
            onChangeText={setStopPrice}
            placeholder="Stop"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.flex, inputStyle]}
          />
        </ThemedView>
        <ThemedView style={styles.row}>
          <TextInput
            value={contracts}
            onChangeText={setContracts}
            placeholder="Contracts"
            keyboardType="number-pad"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.flex, inputStyle]}
          />
          <TextInput
            value={resultR}
            onChangeText={setResultR}
            placeholder="Result (R, opt.)"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.flex, inputStyle]}
          />
        </ThemedView>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes…"
          multiline
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, inputStyle]}
        />
        <Pressable onPress={onAdd} style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Save trade
          </ThemedText>
        </Pressable>
      </ThemedView>

      {entries.map((e) => (
        <ThemedView
          key={e.id}
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedView style={styles.cardHead}>
            <ThemedText type="smallBold">
              {e.direction === 'long' ? '▲' : '▼'} {e.symbol} × {e.contracts}
            </ThemedText>
            <Pressable onPress={() => onDelete(e.id)}>
              <ThemedText type="small" themeColor="textSecondary">
                Delete
              </ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            Entry {e.entry} · Stop {e.stop}
            {typeof e.resultR === 'number'
              ? ` · ${e.resultR > 0 ? '+' : ''}${e.resultR}R`
              : ' · open'}
          </ThemedText>
          {e.timeframeBias ? (
            <ThemedText type="small" themeColor="textSecondary">
              Bias: {e.timeframeBias}
            </ThemedText>
          ) : null}
          {e.notes ? <ThemedText type="small">{e.notes}</ThemedText> : null}
          <ThemedText type="code" themeColor="textSecondary">
            {new Date(e.createdAt).toLocaleString()}
          </ThemedText>
        </ThemedView>
      ))}

      {entries.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          No trades yet. Log your first one above — it stays on this device.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  form: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  dir: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
