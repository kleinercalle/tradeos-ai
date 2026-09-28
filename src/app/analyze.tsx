import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  analyzeCharts,
  geminiProxyConfigured,
  verdictLine,
  type IctReport,
  type TimeframeAnalysis,
  type Verdict,
} from '@/lib/gemini';
import { loadEntries, newEntry, saveEntries } from '@/lib/journal';

const TIMEFRAMES = ['Daily', '1H', '15M', '1M'] as const;
const TF_KEYS = ['daily', 'h1', 'm15', 'm1'] as const;
const BIASES = ['Bullish', 'Bearish', 'Neutral'] as const;
const POIS = ['FVG', 'Order Block', 'Liquidity', 'Breaker', 'OTE', 'Premium/Discount'] as const;
const INSTRUMENTS = ['ES', 'MES', 'NQ', 'MNQ', 'YM', 'MYM', 'RTY'] as const;

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

function verdictColor(v: Verdict): string {
  return v === 'TRADE_CANDIDATE' ? '#2e7d32' : v === 'NO_TRADE' ? '#c62828' : '#ef6c00';
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((t, i) => (
        <ThemedText key={i} type="small" themeColor="textSecondary">
          {'  •  '}
          {t}
        </ThemedText>
      ))}
    </>
  );
}

function TfCard({ label, tf }: { label: string; tf: TimeframeAnalysis }) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">
        {label} — {tf.bias.toUpperCase()}
      </ThemedText>
      <ThemedText type="smallBold">Observed</ThemedText>
      <BulletList items={tf.observed} />
      <ThemedText type="smallBold">Possible</ThemedText>
      <BulletList items={tf.possible} />
      <ThemedText type="smallBold">Not verified</ThemedText>
      <BulletList items={tf.not_verified} />
    </ThemedView>
  );
}

function ImageCheckView({ report }: { report: IctReport }) {
  const theme = useTheme();
  const checks = report.image_check ?? [];
  if (!checks.length && !report.warnings?.length) return null;
  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Screenshot validation</ThemedText>
      {checks.map((c) => (
        <ThemedText key={c.index} type="small" themeColor="textSecondary">
          {c.legible ? '✓' : '⚠'} Image {c.index + 1} ({TIMEFRAMES[c.index] ?? '?'}):{' '}
          {c.instrument_seen ?? '?'} · {c.timeframe_seen ?? '?'}
        </ThemedText>
      ))}
      {(report.warnings ?? []).map((w, i) => (
        <ThemedText key={i} type="small" style={{ color: '#ef6c00' }}>
          ⚠ {w}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

function ReportView({ report }: { report: IctReport }) {
  const theme = useTheme();
  const s = report.synthesis;
  const color = verdictColor(report.verdict);
  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: color, borderWidth: 2 }]}>
      <ThemedText type="subtitle" style={{ color }}>
        {report.verdict.replace(/_/g, ' ')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {report.instrument} · {report.session}
        {report.confidence ? ` · confidence: ${report.confidence}` : ''}
      </ThemedText>
      <ThemedText type="smallBold">HTF narrative</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {s.htf_narrative}
      </ThemedText>
    </ThemedView>
  );
}

export default function AnalyzeScreen() {
  const theme = useTheme();
  const proxyOn = geminiProxyConfigured();
  // 0 = setup, 1..4 = timeframes, 5 = review
  const [step, setStep] = useState(0);
  const [instrument, setInstrument] = useState<string>('NQ');
  const [session, setSession] = useState('');
  const [states, setStates] = useState<TfState[]>(() => TIMEFRAMES.map(emptyTf));
  const [saved, setSaved] = useState(false);

  const [consent, setConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [report, setReport] = useState<IctReport | null>(null);
  const [aiSaved, setAiSaved] = useState(false);

  const tfIndex = step - 1;
  const tf = TIMEFRAMES[tfIndex];
  const cur: TfState = states[tfIndex] ?? emptyTf();

  const patch = (p: Partial<TfState>) => {
    setStates((prev) => prev.map((s, i) => (i === tfIndex ? { ...s, ...p } : s)));
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
        symbol: instrument,
        notes: `ICT checklist — ${biasLine}\n${session ? `Session: ${session}\n` : ''}${detail}\n${states.map((s) => s.notes).filter(Boolean).join(' | ')}`,
        timeframeBias: biasLine,
      }),
      ...existing,
    ]);
    setSaved(true);
  };

  const onAnalyzeAI = async () => {
    setAnalyzing(true);
    setAiError(null);
    setReport(null);
    setAiSaved(false);
    try {
      const r = await analyzeCharts(
        { instrument, session: session.trim() || 'unspecified session', imageUris: states.map((s) => s.imageUri) },
        consent,
      );
      setReport(r);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onSaveAIReport = async () => {
    if (!report) return;
    const s = report.synthesis;
    const text =
      `${verdictLine(report)}\n\n` +
      `HTF: ${s.htf_narrative}\n\n` +
      `Bullish: ${s.bullish_scenario}\nBearish: ${s.bearish_scenario}\n\n` +
      `Invalidation: ${s.invalidation}\nR:R: ${s.risk_reward}\n\n` +
      `Avoid: ${s.avoid_reasons.join(' | ')}`;
    const existing = await loadEntries();
    await saveEntries([
      newEntry({
        symbol: report.instrument,
        notes: text,
        timeframeBias: verdictLine(report),
        aiReport: JSON.stringify(report),
      }),
      ...existing,
    ]);
    setAiSaved(true);
  };

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? theme.text : theme.backgroundElement,
  });
  const chipText = (active: boolean) => ({
    color: active ? theme.background : theme.text,
  });

  // ---- STEP 0: setup ----
  if (step === 0) {
    return (
      <Screen>
        <ThemedText type="subtitle">New analysis</ThemedText>
        <ThemedText type="smallBold">Instrument</ThemedText>
        <ThemedView style={styles.chips}>
          {INSTRUMENTS.map((sym) => (
            <Pressable key={sym} onPress={() => setInstrument(sym)} style={[styles.chip, chipStyle(instrument === sym)]}>
              <ThemedText type="smallBold" style={chipText(instrument === sym)}>
                {sym}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
        <ThemedText type="smallBold">Chart date / session</ThemedText>
        <TextInput
          value={session}
          onChangeText={setSession}
          placeholder="e.g. 2026-09-26 New York"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
        />
        <Pressable
          onPress={() => setStep(1)}
          style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Start → Daily
          </ThemedText>
        </Pressable>
      </Screen>
    );
  }

  // ---- STEP 5: review + AI ----
  if (step === TIMEFRAMES.length + 1) {
    const biasLine = synthesize(states);
    const imageCount = states.filter((s) => s.imageUri).length;
    return (
      <Screen>
        <ThemedText type="subtitle">Review</ThemedText>
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">CHECKLIST SYNTHESIS</ThemedText>
          <ThemedText type="smallBold">{biasLine}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {instrument} · {session || 'session not set'}
          </ThemedText>
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
            {saved ? '✓ Saved to journal' : 'Save checklist to journal'}
          </ThemedText>
        </Pressable>

        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">🤖 AI ANALYSIS</ThemedText>
          {!proxyOn ? (
            <ThemedText type="small" themeColor="textSecondary">
              AI analysis is not configured in this build yet. The checklist above works fully offline.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {imageCount === 4
                  ? `Sends 4 screenshots to the analysis server (${instrument}).`
                  : `Attach all 4 screenshots (Daily, 1H, 15M, 1M) — ${imageCount}/4 attached.`}
              </ThemedText>
              <Pressable onPress={() => setConsent(!consent)} style={styles.consentRow}>
                <ThemedView style={[styles.checkbox, consent && { backgroundColor: theme.text }]}>
                  {consent ? <ThemedText style={{ color: theme.background }}>✓</ThemedText> : null}
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary" style={styles.consentText}>
                  I understand my chart screenshots will be sent to an external server for AI analysis.
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onAnalyzeAI}
                disabled={analyzing || !consent || imageCount !== 4}
                style={[
                  styles.button,
                  { backgroundColor: analyzing || !consent || imageCount !== 4 ? theme.backgroundSelected : theme.text },
                ]}>
                {analyzing ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    Analyze with AI
                  </ThemedText>
                )}
              </Pressable>
              {analyzing ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  Analyzing charts… can take about a minute.
                </ThemedText>
              ) : null}
              {aiError ? (
                <ThemedText type="small" style={[styles.center, { color: '#c62828' }]}>
                  {aiError}
                </ThemedText>
              ) : null}
            </>
          )}
        </ThemedView>

        {report ? (
          <>
            <ImageCheckView report={report} />
            <ReportView report={report} />
            {TF_KEYS.map((k, i) => (
              <TfCard key={k} label={TIMEFRAMES[i]} tf={report.timeframes[k]} />
            ))}
            <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Scenarios</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">▲ {report.synthesis.bullish_scenario}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">▼ {report.synthesis.bearish_scenario}</ThemedText>
              <ThemedText type="smallBold">Liquidity targets</ThemedText>
              <BulletList items={report.synthesis.liquidity_targets} />
              <ThemedText type="smallBold">Missing confirmations</ThemedText>
              <BulletList items={report.synthesis.missing_confirmations} />
              <ThemedText type="smallBold">Entry conditions</ThemedText>
              <BulletList items={report.synthesis.entry_conditions} />
              <ThemedText type="smallBold">Invalidation</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{report.synthesis.invalidation}</ThemedText>
              <ThemedText type="smallBold">Targets</ThemedText>
              <BulletList items={report.synthesis.targets} />
              <ThemedText type="smallBold">Risk / reward</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{report.synthesis.risk_reward}</ThemedText>
              <ThemedText type="smallBold">Reasons to avoid</ThemedText>
              <BulletList items={report.synthesis.avoid_reasons} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Educational analysis — not financial advice.
              </ThemedText>
            </ThemedView>
            <Pressable
              onPress={onSaveAIReport}
              style={[styles.button, { backgroundColor: theme.text }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {aiSaved ? '✓ AI report saved' : 'Save AI report to journal'}
              </ThemedText>
            </Pressable>
          </>
        ) : null}

        <Pressable onPress={() => setStep(0)}>
          <ThemedText type="linkPrimary" style={styles.center}>
            New analysis
          </ThemedText>
        </Pressable>
      </Screen>
    );
  }

  // ---- STEPS 1..4: timeframe checklist ----
  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        STEP {step} / {TIMEFRAMES.length} · {instrument}
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
        <Pressable onPress={() => setStep(step - 1)} style={styles.navBtn}>
          <ThemedText type="linkPrimary">← Back</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setStep(step + 1)}
          style={[styles.button, styles.navBtn, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {step === TIMEFRAMES.length ? 'Review →' : 'Next →'}
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
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  navBtn: { flex: 1 },
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  center: { textAlign: 'center' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.two },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentText: { flex: 1 },
});
