// src/prompt.ts
function buildIctPrompt(instrument, session) {
  return `You are an ICT (Inner Circle Trader) concepts analyst. Analyze the 4 chart screenshots below IN ORDER \u2014 Image 1 is the DAILY timeframe, Image 2 is 1H, Image 3 is 15M, Image 4 is 1M \u2014 all for ${instrument}, session/date: ${session}.

HARD RULES \u2014 violating any of these invalidates your answer:
1. NEVER invent exact price levels, timestamps, or specific candle formations you cannot read reliably from the images. If a level is not legible, say so.
2. For EVERY timeframe, separate your findings into three lists:
   - "observed": only what is clearly readable in that image.
   - "possible": plausible but NOT confirmed from the image.
   - "not_verified": ICT elements you expected but cannot confirm.
3. Analyze each timeframe separately BEFORE combining evidence.
4. If the timeframes contradict each other, or the evidence is insufficient for a directional read, verdict MUST be "NO_TRADE" (or "INSUFFICIENT_DATA" when images are unreadable).
5. This is educational analysis, not financial advice.

Analyze each timeframe for its specific elements:

DAILY (Image 1) \u2014 higher-timeframe context:
- Market structure: confirmed swing highs and lows ONLY where visible
- Buy-side and sell-side liquidity pools
- Previous day / previous week high/low where visible
- Premium vs discount zones
- Likely draw on liquidity
- Higher-timeframe fair value gaps and order blocks

1H (Image 2) \u2014 tactical narrative:
- Directional narrative and internal market structure
- Liquidity targets the price may seek
- Fair value gaps and order blocks
- Displacement (energetic moves away from value)
- Zones where lower-timeframe confirmation could occur

15M (Image 3) \u2014 setup formation:
- Liquidity sweep (raid of highs/lows)
- Market structure shift (MSS): confirmed or only possible
- Displacement after the sweep
- Fair value gap left by displacement
- Retracement / optimal trade entry zones
- Session context (which session the price action belongs to)
- What invalidates the setup

1M (Image 4) \u2014 execution microstructure:
- Microstructure and local liquidity sweep
- Displacement and market structure shift on the entry timeframe
- Entry refinement: where a precise entry could be considered
- Logical stop-loss placement (beyond the swept level / invalidation)
- Potential liquidity targets for partials

SYNTHESIS \u2014 combine the four timeframe reads into:
- Higher-timeframe narrative (one paragraph)
- Bullish scenario and bearish scenario (both, even if one is favored)
- Relevant liquidity targets
- Missing confirmations (what you still need to see)
- Potential entry conditions (ONLY if evidence supports them)
- Invalidation (what proves the idea wrong)
- Potential targets
- Risk/reward ONLY when the numbers are readable from the images; otherwise state it is not calculable
- Reasons to avoid trading this setup

Respond with JSON matching the provided schema. Keep every string concise and factual. Empty arrays are acceptable and HONEST \u2014 do not pad them.`;
}

// ict-schema.json
var ict_schema_default = {
  description: "Structured ICT multi-timeframe analysis. Never invent price levels, timestamps or candle formations that cannot be read reliably from the images.",
  properties: {
    confidence: {
      enum: [
        "low",
        "medium",
        "high"
      ],
      type: "string"
    },
    instrument: {
      type: "string"
    },
    session: {
      type: "string"
    },
    synthesis: {
      properties: {
        avoid_reasons: {
          items: {
            type: "string"
          },
          type: "array"
        },
        bearish_scenario: {
          type: "string"
        },
        bullish_scenario: {
          type: "string"
        },
        entry_conditions: {
          items: {
            type: "string"
          },
          type: "array"
        },
        htf_narrative: {
          type: "string"
        },
        invalidation: {
          type: "string"
        },
        liquidity_targets: {
          items: {
            type: "string"
          },
          type: "array"
        },
        missing_confirmations: {
          items: {
            type: "string"
          },
          type: "array"
        },
        risk_reward: {
          description: "e.g. 'approx 1:2.1 based on readable levels' or 'not calculable \u2014 levels not readable'",
          type: "string"
        },
        targets: {
          items: {
            type: "string"
          },
          type: "array"
        }
      },
      required: [
        "htf_narrative",
        "bullish_scenario",
        "bearish_scenario",
        "liquidity_targets",
        "missing_confirmations",
        "entry_conditions",
        "invalidation",
        "targets",
        "risk_reward",
        "avoid_reasons"
      ],
      type: "object"
    },
    timeframes: {
      properties: {
        daily: {
          properties: {
            bias: {
              enum: [
                "bullish",
                "bearish",
                "neutral",
                "unclear"
              ],
              type: "string"
            },
            not_verified: {
              description: "Expected ICT elements that cannot be confirmed from this image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            notes: {
              type: "string"
            },
            observed: {
              description: "Only what is clearly readable in the image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            possible: {
              description: "Plausible but not confirmed from the image.",
              items: {
                type: "string"
              },
              type: "array"
            }
          },
          required: [
            "bias",
            "observed",
            "possible",
            "not_verified"
          ],
          type: "object"
        },
        h1: {
          properties: {
            bias: {
              enum: [
                "bullish",
                "bearish",
                "neutral",
                "unclear"
              ],
              type: "string"
            },
            not_verified: {
              description: "Expected ICT elements that cannot be confirmed from this image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            notes: {
              type: "string"
            },
            observed: {
              description: "Only what is clearly readable in the image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            possible: {
              description: "Plausible but not confirmed from the image.",
              items: {
                type: "string"
              },
              type: "array"
            }
          },
          required: [
            "bias",
            "observed",
            "possible",
            "not_verified"
          ],
          type: "object"
        },
        m1: {
          properties: {
            bias: {
              enum: [
                "bullish",
                "bearish",
                "neutral",
                "unclear"
              ],
              type: "string"
            },
            not_verified: {
              description: "Expected ICT elements that cannot be confirmed from this image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            notes: {
              type: "string"
            },
            observed: {
              description: "Only what is clearly readable in the image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            possible: {
              description: "Plausible but not confirmed from the image.",
              items: {
                type: "string"
              },
              type: "array"
            }
          },
          required: [
            "bias",
            "observed",
            "possible",
            "not_verified"
          ],
          type: "object"
        },
        m15: {
          properties: {
            bias: {
              enum: [
                "bullish",
                "bearish",
                "neutral",
                "unclear"
              ],
              type: "string"
            },
            not_verified: {
              description: "Expected ICT elements that cannot be confirmed from this image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            notes: {
              type: "string"
            },
            observed: {
              description: "Only what is clearly readable in the image.",
              items: {
                type: "string"
              },
              type: "array"
            },
            possible: {
              description: "Plausible but not confirmed from the image.",
              items: {
                type: "string"
              },
              type: "array"
            }
          },
          required: [
            "bias",
            "observed",
            "possible",
            "not_verified"
          ],
          type: "object"
        }
      },
      required: [
        "daily",
        "h1",
        "m15",
        "m1"
      ],
      type: "object"
    },
    verdict: {
      description: "NO_TRADE when timeframes contradict each other or evidence is insufficient.",
      enum: [
        "TRADE_CANDIDATE",
        "NO_TRADE",
        "INSUFFICIENT_DATA"
      ],
      type: "string"
    }
  },
  required: [
    "instrument",
    "session",
    "timeframes",
    "synthesis",
    "verdict"
  ],
  title: "ICTMultiTimeframeReport",
  type: "object"
};

// src/index.ts
var MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
var GEMINI_TIMEOUT_MS = 11e4;
var MAX_IMAGES = 4;
var MAX_IMAGE_B64_BYTES = 7e6;
var MAX_TOTAL_B64_BYTES = 2e7;
var MAX_OUTPUT_TOKENS = 3e3;
var INSTRUMENTS = /* @__PURE__ */ new Set([
  "ES",
  "MES",
  "NQ",
  "MNQ",
  "YM",
  "MYM",
  "RTY",
  "M2K",
  "GC",
  "MGC",
  "CL",
  "MCL",
  "SI",
  "HG",
  "ZB",
  "ZN"
]);
var ALLOWED_MIME = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var ipHits = /* @__PURE__ */ new Map();
var dayKey = "";
var dayCount = 0;
function rateLimited(ip, env) {
  const perIp = Math.max(1, parseInt(env.RATE_PER_IP_HOUR ?? "5", 10));
  const cap = Math.max(1, parseInt(env.DAILY_CAP ?? "20", 10));
  const now = Date.now();
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= cap) {
    return { limited: true, reason: `Daily analysis budget reached (${cap}/day). Try again tomorrow \u2014 the in-app checklist still works offline.` };
  }
  const windowStart = now - 36e5;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= perIp) {
    return { limited: true, reason: `Rate limit: ${perIp} analyses per hour. Slow down and review the checklist meanwhile.` };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount += 1;
  return { limited: false };
}
function validate(body) {
  if (body.consent !== true) {
    return { ok: false, error: "Explicit consent is required before chart screenshots can be analyzed." };
  }
  const instrument = typeof body.instrument === "string" ? body.instrument.trim().toUpperCase() : "";
  if (!INSTRUMENTS.has(instrument)) {
    return { ok: false, error: `Unknown instrument "${instrument}". Use a supported futures symbol (ES, NQ, \u2026).` };
  }
  const session = typeof body.session === "string" ? body.session.trim().slice(0, 120) : "";
  if (!session) {
    return { ok: false, error: 'Chart date/session is required (e.g. "2026-09-26 London").' };
  }
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return { ok: false, error: "Attach 1\u20134 chart screenshots (Daily, 1H, 15M, 1M)." };
  }
  if (body.images.length > MAX_IMAGES) {
    return { ok: false, error: `Maximum ${MAX_IMAGES} images per analysis.` };
  }
  const images = [];
  let total = 0;
  for (const img of body.images) {
    const mimeType = img.mimeType;
    const data = img.data;
    if (typeof mimeType !== "string" || !ALLOWED_MIME.has(mimeType) || typeof data !== "string") {
      return { ok: false, error: "Each image needs a valid mimeType (jpeg/png/webp) and base64 data." };
    }
    if (data.length > MAX_IMAGE_B64_BYTES) {
      return { ok: false, error: "An image exceeds the 5 MB limit. Re-export the screenshot at lower resolution." };
    }
    total += data.length;
    images.push({ mimeType, data });
  }
  if (total > MAX_TOTAL_B64_BYTES) {
    return { ok: false, error: "Images exceed the 20 MB total limit. Reduce screenshot resolution." };
  }
  return { ok: true, instrument, session, images };
}
async function callGemini(env, prompt, images) {
  const parts = [
    ...images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } })),
    { text: prompt }
  ];
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseSchema: ict_schema_default
    }
  });
  let lastErr = "unknown";
  for (const model of MODEL_CHAIN) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body,
          signal: ctrl.signal
        }
      );
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `Gemini ${model} returned ${res.status}`;
        continue;
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`Gemini ${model} error ${res.status}: ${detail}`);
      }
      const payload = await res.json();
      const text = (payload.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text) throw new Error(`Gemini ${model} returned no content`);
      return { model, text };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Analysis unavailable: ${lastErr}. The manual checklist in the app still works.`);
}
function looksValidReport(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj;
  return typeof o.instrument === "string" && typeof o.session === "string" && typeof o.timeframes === "object" && typeof o.synthesis === "object" && ["TRADE_CANDIDATE", "NO_TRADE", "INSUFFICIENT_DATA"].includes(o.verdict);
}
var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...cors }
    });
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, models: MODEL_CHAIN, dailyCap: env.DAILY_CAP ?? "20" });
    }
    if (url.pathname === "/analyze" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return json({ error: "Server misconfigured: missing Gemini key." }, 500);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be JSON." }, 400);
      }
      const v = validate(body);
      if (!v.ok) return json({ error: v.error }, 400);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const rl = rateLimited(ip, env);
      if (rl.limited) return json({ error: rl.reason }, 429);
      try {
        const prompt = buildIctPrompt(v.instrument, v.session);
        const { model, text } = await callGemini(env, prompt, v.images);
        let report;
        try {
          report = JSON.parse(text);
        } catch {
          return json({ error: "The model returned malformed data. Nothing was saved; try again." }, 502);
        }
        if (!looksValidReport(report)) {
          return json({ error: "The model returned an incomplete report. Nothing was saved; try again." }, 502);
        }
        return json({ report, model, educational: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        const status = msg.includes("unavailable") ? 503 : 500;
        return json({ error: msg }, status);
      }
    }
    return json({ error: "Not found" }, 404);
  }
};
export {
  index_default as default,
  looksValidReport,
  validate
};
