/**
 * TRADEOS AI — Gemini proxy client.
 *
 * The app never holds the Gemini API key. Chart screenshots go to the
 * Cloudflare Worker proxy (EXPO_PUBLIC_GEMINI_PROXY_URL), which validates,
 * rate-limits, and calls Gemini with the key from a Worker secret.
 *
 * No secrets here — just the public proxy URL. Consent must be obtained
 * in the UI before calling analyzeCharts().
 */
import * as FileSystem from 'expo-file-system/legacy';

const PROXY_URL =
  process.env.EXPO_PUBLIC_GEMINI_PROXY_URL?.trim().replace(/\/+$/, '') ?? '';

export function geminiProxyConfigured(): boolean {
  return PROXY_URL.length > 0;
}

export type Verdict = 'TRADE_CANDIDATE' | 'NO_TRADE' | 'INSUFFICIENT_DATA';
export type TfBias = 'bullish' | 'bearish' | 'neutral' | 'unclear';

export interface TimeframeAnalysis {
  bias: TfBias;
  observed: string[];
  possible: string[];
  not_verified: string[];
  notes?: string;
}

export interface IctSynthesis {
  htf_narrative: string;
  bullish_scenario: string;
  bearish_scenario: string;
  liquidity_targets: string[];
  missing_confirmations: string[];
  entry_conditions: string[];
  invalidation: string;
  targets: string[];
  risk_reward: string;
  avoid_reasons: string[];
}

export interface IctReport {
  instrument: string;
  session: string;
  timeframes: {
    daily: TimeframeAnalysis;
    h1: TimeframeAnalysis;
    m15: TimeframeAnalysis;
    m1: TimeframeAnalysis;
  };
  synthesis: IctSynthesis;
  verdict: Verdict;
  confidence?: 'low' | 'medium' | 'high';
}

export interface AnalyzeInput {
  instrument: string;
  session: string;
  /** local image URIs in order: Daily, 1H, 15M, 1M (nulls skipped) */
  imageUris: (string | null)[];
}

export type GeminiErrorCode =
  | 'no_consent'
  | 'not_configured'
  | 'network'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_response';

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  constructor(message: string, code: GeminiErrorCode) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

function mimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function analyzeCharts(
  input: AnalyzeInput,
  consent: boolean,
): Promise<IctReport> {
  if (!consent) {
    throw new GeminiError(
      'Please confirm consent before sending screenshots for analysis.',
      'no_consent',
    );
  }
  if (!geminiProxyConfigured()) {
    throw new GeminiError(
      'AI analysis is not configured in this build yet.',
      'not_configured',
    );
  }
  const uris = input.imageUris.filter((u): u is string => !!u);
  if (uris.length === 0) {
    throw new GeminiError(
      'Attach at least one chart screenshot first.',
      'bad_response',
    );
  }

  const images: { mimeType: string; data: string }[] = [];
  for (const uri of uris.slice(0, 4)) {
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    images.push({ mimeType: mimeFromUri(uri), data });
  }

  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 150_000);
    try {
      res = await fetch(`${PROXY_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          instrument: input.instrument,
          session: input.session,
          images,
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    throw new GeminiError(
      'Could not reach the analysis server. Check your connection and try again.',
      'network',
    );
  }

  const payload = (await res.json().catch(() => null)) as {
    report?: IctReport;
    error?: string;
  } | null;

  if (!res.ok) {
    const msg = payload?.error ?? `Analysis server error (${res.status}).`;
    throw new GeminiError(
      msg,
      res.status === 429 ? 'rate_limited' : res.status === 503 ? 'unavailable' : 'bad_response',
    );
  }
  const report = payload?.report;
  if (!report || typeof report.verdict !== 'string' || !report.timeframes || !report.synthesis) {
    throw new GeminiError(
      'The server returned an incomplete report. Nothing was saved — try again.',
      'bad_response',
    );
  }
  return report;
}

/** One-line summary for the journal / lists. */
export function verdictLine(report: IctReport): string {
  const emoji =
    report.verdict === 'TRADE_CANDIDATE'
      ? '🟢'
      : report.verdict === 'NO_TRADE'
        ? '🔴'
        : '🟡';
  return `${emoji} AI ${report.verdict.replace(/_/g, ' ')} — ${report.instrument} ${report.session}`;
}
