/**
 * TRADEOS AI — Gemini proxy (Cloudflare Workers, free tier).
 *
 * The Android app never holds the Gemini API key. It POSTs chart
 * screenshots here; this Worker validates, rate-limits, and forwards
 * to Gemini with the key from a Worker secret (GEMINI_API_KEY).
 *
 * POST /analyze { consent, instrument, session, images[] }
 * GET  /health
 */
import { buildIctPrompt } from './prompt';
import ICT_SCHEMA from '../ict-schema.json';

export interface Env {
  GEMINI_API_KEY: string;
  /** requests per IP per hour (default 5) */
  RATE_PER_IP_HOUR?: string;
  /** total analyses per UTC day across all users (default 20 = free tier) */
  DAILY_CAP?: string;
}

const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
const GEMINI_TIMEOUT_MS = 110_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_B64_BYTES = 7_000_000; // ~5 MB decoded
const MAX_TOTAL_B64_BYTES = 20_000_000;
const MAX_OUTPUT_TOKENS = 3000;

const INSTRUMENTS = new Set([
  'ES', 'MES', 'NQ', 'MNQ', 'YM', 'MYM', 'RTY', 'M2K',
  'GC', 'MGC', 'CL', 'MCL', 'SI', 'HG', 'ZB', 'ZN',
]);

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// --- in-memory rate limiting (per isolate; upgrade to KV for multi-user scale)
const ipHits = new Map<string, number[]>();
let dayKey = '';
let dayCount = 0;

function rateLimited(ip: string, env: Env): { limited: boolean; reason?: string } {
  const perIp = Math.max(1, parseInt(env.RATE_PER_IP_HOUR ?? '5', 10));
  const cap = Math.max(1, parseInt(env.DAILY_CAP ?? '20', 10));
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= cap) {
    return { limited: true, reason: `Daily analysis budget reached (${cap}/day). Try again tomorrow — the in-app checklist still works offline.` };
  }
  const windowStart = now - 3_600_000;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= perIp) {
    return { limited: true, reason: `Rate limit: ${perIp} analyses per hour. Slow down and review the checklist meanwhile.` };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount += 1;
  return { limited: false };
}

interface AnalyzeBody {
  consent?: unknown;
  instrument?: unknown;
  session?: unknown;
  images?: unknown;
}

export function validate(body: AnalyzeBody): { ok: true; instrument: string; session: string; images: { mimeType: string; data: string }[] } | { ok: false; error: string } {
  if (body.consent !== true) {
    return { ok: false, error: 'Explicit consent is required before chart screenshots can be analyzed.' };
  }
  const instrument = typeof body.instrument === 'string' ? body.instrument.trim().toUpperCase() : '';
  if (!INSTRUMENTS.has(instrument)) {
    return { ok: false, error: `Unknown instrument "${instrument}". Use a supported futures symbol (ES, NQ, …).` };
  }
  const session = typeof body.session === 'string' ? body.session.trim().slice(0, 120) : '';
  if (!session) {
    return { ok: false, error: 'Chart date/session is required (e.g. "2026-09-26 London").' };
  }
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return { ok: false, error: 'Attach 1–4 chart screenshots (Daily, 1H, 15M, 1M).' };
  }
  if (body.images.length > MAX_IMAGES) {
    return { ok: false, error: `Maximum ${MAX_IMAGES} images per analysis.` };
  }
  const images: { mimeType: string; data: string }[] = [];
  let total = 0;
  for (const img of body.images) {
    const mimeType = (img as { mimeType?: unknown }).mimeType;
    const data = (img as { data?: unknown }).data;
    if (typeof mimeType !== 'string' || !ALLOWED_MIME.has(mimeType) || typeof data !== 'string') {
      return { ok: false, error: 'Each image needs a valid mimeType (jpeg/png/webp) and base64 data.' };
    }
    if (data.length > MAX_IMAGE_B64_BYTES) {
      return { ok: false, error: 'An image exceeds the 5 MB limit. Re-export the screenshot at lower resolution.' };
    }
    total += data.length;
    images.push({ mimeType, data });
  }
  if (total > MAX_TOTAL_B64_BYTES) {
    return { ok: false, error: 'Images exceed the 20 MB total limit. Reduce screenshot resolution.' };
  }
  return { ok: true, instrument, session, images };
}

async function callGemini(env: Env, prompt: string, images: { mimeType: string; data: string }[]): Promise<{ model: string; text: string }> {
  const parts = [
    ...images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } })),
    { text: prompt },
  ];
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: ICT_SCHEMA,
    },
  });
  let lastErr = 'unknown';
  for (const model of MODEL_CHAIN) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body,
          signal: ctrl.signal,
        },
      );
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `Gemini ${model} returned ${res.status}`;
        continue; // try next model
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`Gemini ${model} error ${res.status}: ${detail}`);
      }
      const payload = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('');
      if (!text) throw new Error(`Gemini ${model} returned no content`);
      return { model, text };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Analysis unavailable: ${lastErr}. The manual checklist in the app still works.`);
}

/** Minimal structural check — the schema itself is enforced by Gemini. */
export function looksValidReport(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.instrument === 'string' &&
    typeof o.session === 'string' &&
    Array.isArray(o.image_check) &&
    typeof o.timeframes === 'object' &&
    typeof o.synthesis === 'object' &&
    ['TRADE_CANDIDATE', 'NO_TRADE', 'INSUFFICIENT_DATA'].includes(o.verdict as string)
  );
}

export interface ImageCheck {
  index: number;
  instrument_seen: string | null;
  timeframe_seen: string | null;
  legible: boolean;
  note?: string;
}

export type ConsistencyResult =
  | { ok: true; warnings: string[] }
  | { ok: false; code: 'instrument_mismatch' | 'timeframe_mismatch'; error: string };

const EXPECTED_TF = ['Daily', '1H', '15M', '1M'] as const;

/** Normalize a timeframe label the model read off a chart ("15m", "M15", "D" …). */
export function normalizeTf(label: string | null): string | null {
  if (!label) return null;
  const t = label.trim().toUpperCase().replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    D: 'DAILY', '1D': 'DAILY', DAILY: 'DAILY',
    H1: '1H', '1H': '1H', '60': '1H', '60M': '1H',
    M15: '15M', '15M': '15M', '15': '15M',
    M1: '1M', '1M': '1M', '1': '1M',
    M5: '5M', '5M': '5M', '5': '5M',
    M30: '30M', '30M': '30M',
    H4: '4H', '4H': '4H',
    W: 'WEEKLY', '1W': 'WEEKLY',
  };
  return aliases[t] ?? t;
}

export function normalizeInstrument(sym: string | null): string | null {
  if (!sym) return null;
  return sym.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Deterministic screenshot-consistency gate.
 * Blocks the analysis (ok:false) when images provably contradict the
 * declared setup: mixed instruments, or a chart whose printed timeframe
 * does not match its slot. Unreadable labels produce warnings, not blocks.
 */
export function checkConsistency(
  imageCheck: ImageCheck[],
  expectedInstrument: string,
  imageCount: number,
): ConsistencyResult {
  const warnings: string[] = [];
  const expected = normalizeInstrument(expectedInstrument) ?? '';

  const seenInstruments = new Map<string, number[]>();
  for (const c of imageCheck) {
    const sym = normalizeInstrument(c.instrument_seen);
    if (sym) {
      if (!seenInstruments.has(sym)) seenInstruments.set(sym, []);
      seenInstruments.get(sym)!.push(c.index);
    } else if (c.legible) {
      warnings.push(`Image ${c.index + 1}: instrument label not readable.`);
    }
  }
  if (seenInstruments.size > 1) {
    const parts = [...seenInstruments.entries()]
      .map(([s, idx]) => `${s} (image ${idx.map((i) => i + 1).join(', ')})`)
      .join(' vs ');
    return {
      ok: false,
      code: 'instrument_mismatch',
      error: `Screenshots show different instruments: ${parts}. Replace the images that don't match ${expected || 'the selected instrument'} — analysis blocked.`,
    };
  }
  if (seenInstruments.size === 1) {
    const [seen] = [...seenInstruments.keys()];
    if (expected && seen !== expected) {
      return {
        ok: false,
        code: 'instrument_mismatch',
        error: `Screenshots show ${seen} but the analysis was requested for ${expected}. Fix the instrument or replace the images — analysis blocked.`,
      };
    }
  }

  for (const c of imageCheck) {
    if (c.index < 0 || c.index >= imageCount) continue;
    const seenTf = normalizeTf(c.timeframe_seen);
    const wantTf = normalizeTf(EXPECTED_TF[c.index] ?? '');
    if (seenTf && wantTf && seenTf !== wantTf) {
      return {
        ok: false,
        code: 'timeframe_mismatch',
        error: `Image ${c.index + 1} is labeled "${c.timeframe_seen}" but sits in the ${EXPECTED_TF[c.index]} slot. Replace it with the correct ${EXPECTED_TF[c.index]} chart — analysis blocked.`,
      };
    }
    if (!c.legible) {
      warnings.push(`Image ${c.index + 1} (${EXPECTED_TF[c.index] ?? '?'}): not legible enough to verify.`);
    } else if (!seenTf) {
      warnings.push(`Image ${c.index + 1}: timeframe label not readable.`);
    }
  }
  return { ok: true, warnings };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, models: MODEL_CHAIN, dailyCap: env.DAILY_CAP ?? '20' });
    }

    if (url.pathname === '/analyze' && request.method === 'POST') {
      if (!env.GEMINI_API_KEY) {
        return json({ error: 'Server misconfigured: missing Gemini key.' }, 500);
      }
      let body: AnalyzeBody;
      try {
        body = (await request.json()) as AnalyzeBody;
      } catch {
        return json({ error: 'Request body must be JSON.' }, 400);
      }
      const v = validate(body);
      if (!v.ok) return json({ error: v.error }, 400);

      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const rl = rateLimited(ip, env);
      if (rl.limited) return json({ error: rl.reason }, 429);

      try {
        const prompt = buildIctPrompt(v.instrument, v.session);
        const { model, text } = await callGemini(env, prompt, v.images);
        let report: unknown;
        try {
          report = JSON.parse(text);
        } catch {
          return json({ error: 'The model returned malformed data. Nothing was saved; try again.' }, 502);
        }
        if (!looksValidReport(report)) {
          return json({ error: 'The model returned an incomplete report. Nothing was saved; try again.' }, 502);
        }
        const consistency = checkConsistency(
          (report as { image_check: ImageCheck[] }).image_check,
          v.instrument,
          v.images.length,
        );
        if (!consistency.ok) {
          return json({ error: consistency.error, code: consistency.code }, 422);
        }
        const warnings = consistency.warnings;
        return json({ report, model, educational: true, warnings });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Analysis failed';
        const status = msg.includes('unavailable') ? 503 : 500;
        return json({ error: msg }, status);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
