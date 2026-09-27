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
    typeof o.timeframes === 'object' &&
    typeof o.synthesis === 'object' &&
    ['TRADE_CANDIDATE', 'NO_TRADE', 'INSUFFICIENT_DATA'].includes(o.verdict as string)
  );
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
        return json({ report, model, educational: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Analysis failed';
        const status = msg.includes('unavailable') ? 503 : 500;
        return json({ error: msg }, status);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
