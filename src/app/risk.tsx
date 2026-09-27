import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  calculateAdvancedRisk,
  FUTURES_SPECS,
  type AdvancedRiskResult,
  type Direction,
} from '@/lib/risk';

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

function Chips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onPick(o)}
          style={[
            styles.chip,
            { backgroundColor: o === value ? theme.text : theme.backgroundElement },
          ]}>
          <ThemedText
            type="smallBold"
            style={{ color: o === value ? theme.background : theme.text }}>
            {o}
          </ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const num = (v: string): number | undefined => {
  const n = parseFloat(v);
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

export default function RiskScreen() {
  const theme = useTheme();
  const symbols = Object.keys(FUTURES_SPECS);
  const [direction, setDirection] = useState<Direction>('long');
  const [symbol, setSymbol] = useState('MES');
  const [balance, setBalance] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [commission, setCommission] = useState('');
  const [slippage, setSlippage] = useState('');
  const [maxRisk, setMaxRisk] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [ddMax, setDdMax] = useState('');
  const [ddPeak, setDdPeak] = useState('');
  const [ddTrailing, setDdTrailing] = useState(true);
  const [result, setResult] = useState<AdvancedRiskResult | null>(null);

  const onCalculate = () => {
    const ddMaxN = num(ddMax);
    const ddPeakN = num(ddPeak);
    setResult(
      calculateAdvancedRisk({
        accountBalance: parseFloat(balance),
        riskPercent: parseFloat(riskPct),
        entryPrice: parseFloat(entry),
        stopPrice: parseFloat(stop),
        spec: FUTURES_SPECS[symbol],
        direction,
        commissionPerContract: num(commission),
        slippageTicks: num(slippage),
        maxRiskPerTrade: num(maxRisk),
        dailyRiskBudget: num(dailyBudget),
        drawdown:
          ddMaxN && ddMaxN > 0 && ddPeakN && ddPeakN > 0
            ? {
                maxDrawdown: ddMaxN,
                trailing: ddTrailing,
                peakBalance: ddPeakN,
                currentBalance: parseFloat(balance),
              }
            : undefined,
      }),
    );
  };

  return (
    <Screen>
      <ThemedText type="subtitle">Risk Calculator</ThemedText>
      <ThemedText themeColor="textSecondary">
        Futures position sizing. Same input, same output — every time.
      </ThemedText>

      <ThemedText type="smallBold">Direction</ThemedText>
      <Chips
        options={['long', 'short'] as const}
        value={direction}
        onPick={setDirection}
      />

      <ThemedText type="smallBold">Quick switch</ThemedText>
      <Chips
        options={['NQ', 'MNQ', 'ES', 'MES'] as const}
        value={symbol}
        onPick={setSymbol}
      />

      <ThemedText type="smallBold">Contract</ThemedText>
      <Chips options={symbols} value={symbol} onPick={setSymbol} />

      <Field label="Account balance ($)" value={balance} onChange={setBalance} placeholder="10000" />
      <Field label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} placeholder="1" />
      <Field label="Entry price" value={entry} onChange={setEntry} placeholder="6000" />
      <Field label="Stop price" value={stop} onChange={setStop} placeholder="5995" />

      <ThemedText type="smallBold">Costs (optional)</ThemedText>
      <Field label="Commission round-trip ($/contract)" value={commission} onChange={setCommission} placeholder="4.20" />
      <Field label="Slippage (ticks)" value={slippage} onChange={setSlippage} placeholder="1" />

      <ThemedText type="smallBold">Limits (optional)</ThemedText>
      <Field label="Max risk per trade ($)" value={maxRisk} onChange={setMaxRisk} placeholder="150" />
      <Field label="Daily risk budget remaining ($)" value={dailyBudget} onChange={setDailyBudget} placeholder="300" />

      <ThemedText type="smallBold">Prop drawdown (optional)</ThemedText>
      <Field label="Max drawdown ($)" value={ddMax} onChange={setDdMax} placeholder="2000" />
      <Field label="Peak balance ($)" value={ddPeak} onChange={setDdPeak} placeholder="12000" />
      <ThemedText type="small" themeColor="textSecondary">
        Trailing
      </ThemedText>
      <Chips
        options={['trailing', 'static'] as const}
        value={ddTrailing ? 'trailing' : 'static'}
        onPick={(v) => setDdTrailing(v === 'trailing')}
      />

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
            POSITION SIZE · {result.direction.toUpperCase()}
          </ThemedText>
          <ThemedText type="title">
            {result.contracts} × {symbol}
          </ThemedText>
          <ThemedText>
            Risking ${result.actualRisk.toFixed(2)} ({result.actualRiskPercent}% of
            account)
            {result.totalCosts > 0 ? ` + $${result.totalCosts.toFixed(2)} costs` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Stop: {result.stopPoints} pts · {result.stopTicks} ticks · $
            {result.lossPerContract.toFixed(2)}/contract
            {result.costPerContract > 0 ? ` · $${result.costPerContract.toFixed(2)} costs/contract` : ''}
          </ThemedText>
          {result.maxContractsByDailyBudget !== null && (
            <ThemedText type="small" themeColor="textSecondary">
              Daily budget fits {result.maxContractsByDailyBudget} contract(s).
            </ThemedText>
          )}
          {result.remainingDrawdown !== null && (
            <ThemedText
              type="small"
              style={{ color: result.drawdownBreached ? '#c62828' : undefined }}
              themeColor={result.drawdownBreached ? undefined : 'textSecondary'}>
              Drawdown remaining: ${result.remainingDrawdown.toFixed(2)}
              {result.drawdownBreached ? ' — BREACHED' : ''}
            </ThemedText>
          )}
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
