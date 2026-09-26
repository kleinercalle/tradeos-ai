import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateRisk, FUTURES_SPECS, type RiskResult } from '@/lib/risk';

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      />
    </ThemedView>
  );
}

export default function RiskScreen() {
  const theme = useTheme();
  const symbols = Object.keys(FUTURES_SPECS);
  const [symbol, setSymbol] = useState('MES');
  const [balance, setBalance] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [result, setResult] = useState<RiskResult | null>(null);

  const onCalculate = () => {
    setResult(
      calculateRisk({
        accountBalance: parseFloat(balance),
        riskPercent: parseFloat(riskPct),
        entryPrice: parseFloat(entry),
        stopPrice: parseFloat(stop),
        spec: FUTURES_SPECS[symbol],
      }),
    );
  };

  return (
    <Screen>
      <ThemedText type="subtitle">Risk Calculator</ThemedText>
      <ThemedText themeColor="textSecondary">
        Futures position sizing. Same input, same output — every time.
      </ThemedText>

      <ThemedText type="smallBold">Contract</ThemedText>
      <ThemedView style={styles.chips}>
        {symbols.map((s) => (
          <Pressable
            key={s}
            onPress={() => setSymbol(s)}
            style={[
              styles.chip,
              {
                backgroundColor:
                  s === symbol ? theme.text : theme.backgroundElement,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: s === symbol ? theme.background : theme.text }}>
              {s}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      <Field label="Account balance ($)" value={balance} onChange={setBalance} placeholder="10000" />
      <Field label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} placeholder="1" />
      <Field label="Entry price" value={entry} onChange={setEntry} placeholder="6000" />
      <Field label="Stop price" value={stop} onChange={setStop} placeholder="5995" />

      <Pressable
        onPress={onCalculate}
        style={[styles.button, { backgroundColor: theme.text }]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Calculate size
        </ThemedText>
      </Pressable>

      {result && (
        <ThemedView style={[styles.result, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            POSITION SIZE
          </ThemedText>
          <ThemedText type="title">
            {result.contracts} × {symbol}
          </ThemedText>
          <ThemedText>
            Risking ${result.actualRisk.toFixed(2)} ({result.actualRiskPercent}% of
            account)
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Stop: {result.stopPoints} pts · {result.stopTicks} ticks · $
            {result.lossPerContract.toFixed(2)}/contract
          </ThemedText>
          {result.warnings.map((w) => (
            <ThemedText key={w} type="small" style={styles.warn}>
              ⚠ {w}
            </ThemedText>
          ))}
        </ThemedView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  result: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  warn: { color: '#B45309' },
});
