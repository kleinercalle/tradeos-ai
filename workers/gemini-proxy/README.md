# TRADEOS AI — Gemini proxy (Cloudflare Workers, free tier)

Secure backend between the Android app and the Gemini API.
The app never holds the Gemini key.

## Deploy (needs a free Cloudflare account — user action)

```bash
cd workers/gemini-proxy
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY   # paste the AI Studio key here
npm run deploy
```

Note the `*.workers.dev` URL and set it in the app as
`EXPO_PUBLIC_GEMINI_PROXY_URL` (plain URL, not a secret).

## API

- `GET /health` → `{ ok, models, dailyCap }`
- `POST /analyze`
  ```json
  {
    "consent": true,
    "instrument": "NQ",
    "session": "2026-09-26 New York",
    "images": [{ "mimeType": "image/jpeg", "data": "<base64>" }]
  }
  ```
  Returns `{ report, model, educational: true }` or `{ error }`.

## Guards

- Consent required; 1–4 images; 5 MB/image; 20 MB total
- Per-IP 5 req/hour; global 20 analyses/day (env-tunable)
- Model chain 3.8 → 3.7 → 3.6 → 2.5-flash; 110 s timeout
- JSON schema enforced by Gemini + structural check here
- Honest errors only — never fake analysis
