# TRADEOS AI — Progress Log

> Autonomous PM log. Read this first before writing any code.
> Last updated: 2026-09-26 (M1 in progress).

## What this is

Android app for the **RevenueCat Shipaton 2026**, built with React Native + Expo
(SDK 57, expo-router, TypeScript). Local-first: journal and analysis live in
AsyncStorage on the device — no backend, no account.

**MVP scope (ship first):**
1. ICT screenshot-analysis flow — guided Daily → 1H → 15M → 1M bias checklist
   with screenshot attach + deterministic synthesis (AI vision deferred to M2)
2. Deterministic risk calculator — futures position sizing, pure functions
3. Trading journal — local-first, AsyncStorage
4. RevenueCat paywall — `react-native-purchases`, "pro" entitlement

**Explicitly deferred until after launch:** licensed real-time market data,
live alerts, advanced backtesting.

## Hard constraints (user's words)

- **Minimize cost. $0 budget.** Never purchase credits or enable paid billing
  without the user's explicit approval.
- Free-tier API usage is NOT unlimited — quotas were evaluated, see below.
- Small tasks, commit to GitHub after every completed milestone, run tests.
- VS Code + Cline + free-tier Gemini is the user's preferred implementation
  setup for continued work.

## Research findings (verified 2026-09-26)

### Shipaton — deadline pressure is the critical path
- **Submission deadline: Sep 30, 2026, 11:45 PM PDT.** (~4 days from project start)
- App must be **publicly published** on Google Play, App Store, or Samsung
  Galaxy Store. A sideloaded APK/AAB or testing track does NOT qualify.
- RevenueCat SDK must power ≥1 real purchase (or RevenueCat Ads). Judges get a
  free trial or promo code to test premium features.
- Submission needs: description, **≤2 min demo video** (YouTube/Vimeo),
  store URL, 1024×1024 icon, ≥1 screenshot at 1179×2556 (no device frame).
- **User decision (2026-09-26): target Samsung Galaxy Store.**

### Store strategy
- **Google Play is blocked for a new account:** personal accounts created after
  2023-11-13 must run a 14-day closed test with ≥12 testers before production
  access. $25 fee. Impossible in 4 days.
- **Samsung Galaxy Store:** free seller account, review typically 1–3 business
  days, accepts APK/AAB, no tester gate. Tight but viable.
- New apps must target **API 36 (Android 16)** (enforced since 2026-08-31).

### Quotas & costs — everything is $0
| Service | Free tier | Binding constraint |
|---|---|---|
| Expo EAS Build | 15 Android builds/mo, no billing attached (cannot be charged) | Low-priority queue; 45-min timeout. `eas build --local` bypasses quota entirely |
| RevenueCat | $0 until $2,500/mo tracked revenue, no card required | None at our scale |
| Gemini API (AI Studio) | No card needed | **~20 req/day** on full Flash models; ~500/day on Flash-Lite. Per Google Cloud project, resets midnight PT |

### Gemini model selection (for Cline in VS Code)
- Usable free set on **new** keys: `gemini-3.x-flash` line
  (`gemini-3.5-flash` recommended — has thinking/reasoning). The 2.5 line
  returns 404 for new free keys despite the pricing page.
- **Strategy:** `gemini-3.5-flash` for reasoning/planning steps (budget: ~20
  req/day ≈ 1–2 agentic tasks), `gemini-3.5-flash-lite` for high-volume routine
  edits (~500 req/day, weaker reasoning). Works with Cline via BYOK
  (native Gemini provider or OpenAI-compatible endpoint). No billing needed.
- Heavy sustained coding on free tier alone is NOT practical — plan paid
  fallback only with user approval.

## Milestones

### M0 — Scaffold ✅ (2026-09-26)
- `npx create-expo-app` (Expo 57 tabs template, expo-router, TS, React 19.2)
- git init, branch `main`, commit `704faec`

### M1 — First working app + Android build 🔨 (in progress)
- [x] `src/lib/risk.ts` — deterministic calculator (9 futures specs, tick-grid
      validation, floor-not-round sizing)
- [x] `src/lib/risk.test.ts` — 7 unit tests (node:test + tsx)
- [x] `src/lib/journal.ts` — AsyncStorage journal store
- [x] `src/lib/purchases.ts` — RevenueCat wiring, safe no-key fallback
- [x] Screens: Home, Analyze (ICT 4-timeframe flow), Risk, Journal, Pro paywall
- [x] 5-tab native tab bar + generated tab icons
- [x] `app.json`: android package `com.tradeosai.app`, image-picker plugin
- [x] `eas.json`: preview (APK) / production (AAB) profiles
- [x] `npm test` green (8/8)
- [x] `npx tsc --noEmit` + `npx expo lint` clean
- [ ] Local release APK via prebuild + gradle (JDK 17 + Android SDK install)
- [ ] Push to GitHub ⏳ blocked on user auth (device flow)

### M2 — AI vision (after M1)
- Gemini 3.5 Flash vision on attached screenshots: ICT annotation
  (liquidity, FVG, OB) per timeframe. Key stays on-device; free-tier RPD
  budget shown in-app.

### M3 — Store submission (deadline Sep 30)
- RevenueCat: create "pro" entitlement + offering, add
  `EXPO_PUBLIC_REVENUECAT_API_KEY` to `.env` (never commit)
- Signed release AAB/APK → Samsung Seller Portal → review
- Demo video ≤2 min, screenshots 1179×2556, 1024 icon, promo code for judges

### M4 — Post-launch (deferred per user)
Real-time data licensing, live alerts, advanced backtesting.

## Environment notes (this VM)

- Node 24.20, npm 10.9.4. **No `node_modules/.bin` is created** by npm here —
  run the Expo CLI as `node node_modules/expo/bin/cli …` instead of `npx expo`.
- No Java / Android SDK yet — M1 build step installs: Temurin JDK 17 +
  Android cmdline tools + platform android-36 + build-tools 36.
- `gh` CLI installed but **not authenticated** — repo push needs the user's
  device-flow login.

## Blockers / waiting on user

1. **GitHub auth** — one-time `gh auth login` device code (user enters at
   github.com/login/device). Then: `gh repo create tradeos-ai --public --source=. --push`.
2. **Samsung Seller account** — user creates at seller.samsungapps.com (free,
   1–2 day verification). Only the user can do identity verification.
3. **RevenueCat API key** — user creates free account, Android app, "pro"
   entitlement; key goes in local `.env` (gitignored).

## Commands

```bash
node node_modules/expo/bin/cli install <pkg>  # add deps (NOT npm add)
npm test                                        # unit tests (tsx --test)
node node_modules/typescript/bin/tsc --noEmit  # typecheck
node node_modules/expo/bin/cli lint            # lint
node node_modules/expo/bin/cli prebuild --platform android  # generate android/
```

## Conventions for continuing agents

- Keep `src/lib/` pure and tested; screens thin.
- Never commit `.env`, keystores, or API keys.
- Every milestone: tests green → commit → push → append to this log.
- Money math stays in `src/lib/risk.ts` — deterministic, no AI in the loop.

## 2026-09-26 — Build pivot: local Gradle -> EAS cloud
- Local `./gradlew assembleDebug` is BLOCKED in this sandbox: loopback TCP is
  intercepted (a Java socket test showed 127.0.0.1 traffic answered by the
  sandbox instead of the peer), so the Gradle daemon client<->daemon handshake
  dies with "Broken pipe". No Gradle version can work around this.
- Pivot: EAS cloud build (Free tier: 30 builds/mo total incl. Android, no card,
  no billing). eas.json already has preview->APK and production->AAB.
- Needs: user's Expo access token (free account at expo.dev). Used once as
  EXPO_TOKEN, never stored.
- Toolchain notes for handoff: JDK17 at ~/jdk17, SDK at ~/Android/Sdk
  (platform-tools, platforms/android-36, build-tools/36.0.0 installed manually
  via curl because sdkmanager's Java networking can't traverse the proxy),
  Gradle 9.3.1 at ~/gradle/gradle-9.3.1, proxy in ~/.gradle/gradle.properties.

## 2026-09-26 — First APK built via GitHub Actions (success)
- EAS cloud build abandoned for now: the EXPO_TOKEN is a robot token that
  cannot CREATE Android keystores on Expo servers (needs a user session), and
  credentials.json only works in interactive `eas credentials`.
- GitHub Actions workflow `.github/workflows/android-preview.yml`:
  ubuntu-latest, Node 24, Temurin JDK 17, npm ci, expo prebuild, gradle
  assembleDebug, uploads APK artifact. Trigger: workflow_dispatch.
- Run 36277800447: success. APK: 233MB, package com.tradeosai.app,
  versionName 1.0.0 (versionCode 1), minSdk 24, targetSdk 36, signed (debug).
- Release keystore generated locally at android/keystores/tradeos-release.jks
  (gitignored) + credentials.json (gitignored). Needed later for the
  Galaxy Store signed release/AAB.
- APK copy: ~/workspace/your_files/tradeos-ai-preview.apk

## 2026-09-26 — Release v1.0.0-preview con APK directo
- Nuevo workflow `.github/workflows/release-apk.yml`: al publicar una release
  (trigger `release: published`) compila el APK y lo adjunta automáticamente
  como asset `tradeos-ai-<tag>.apk` con `softprops/action-gh-release@v2`.
- Release v1.0.0-preview creada; workflow run 36279135787: success.
- Asset: tradeos-ai-v1.0.0-preview.apk (233MB), package com.tradeosai.app,
  versionName 1.0.0, minSdk 24, targetSdk 36, firma verificada con apksigner.
- Tests: 8/8 (tsx --test). tsc --noEmit y expo lint limpios. Package name
  sin cambios; código existente intacto.
- Release page: https://github.com/kleinercalle/tradeos-ai/releases/tag/v1.0.0-preview

## 2026-09-26 — Startup fix (v1.0.1): infinite splash resolved

**Symptom:** v1.0.0-preview APK installed on Samsung but stuck forever on the blue Expo splash.

**Root cause (proven with emulator logcat):** the release workflow built with
`./gradlew assembleDebug`, which does NOT package the JS bundle. On launch,
`ReactInstance.loadJSBundleFromAssets` threw
`java.lang.RuntimeException: Unable to load script` → the app could never
start. Confirmed: v1.0.0-preview APK contains zero `index.android.bundle`.

**Second latent bug (fixed):** `Colors[scheme]` in `app-tabs.tsx:19` and
`use-theme.ts` threw a TypeError when `useColorScheme()` returned
null/undefined — also froze the app on the splash. Fixed via
`resolveColorScheme()` helper (`src/lib/color-scheme.ts`) + regression tests.

**Changes:**
- `release-apk.yml`: now builds `assembleRelease` with a real release
  keystore (PKCS12, CN=TRADEOS AI, valid to 2056; credentials in GitHub
  Secrets: ANDROID_KEYSTORE_BASE64/PASSWORD/ALIAS/KEY_PASSWORD) + signature
  verification step.
- `android-emulator-test.yml`: cold-start test now uses the release APK
  (install → force-stop → launch → 30s → screenshot + logcat artifacts).
- `_layout.tsx`: SplashErrorBoundary + last-resort timers guarantee
  `hideAsync()` always runs — the splash can never be infinite again.
- `animated-icon.tsx`: splash overlay simplified — fixed-timer dismissal,
  no worklet-callback dependency in the critical path.

**Proof (emulator, API 34, cold start):** screenshot shows TRADEOS AI Home
fully rendered with native tabs; logcat has 0 FATAL EXCEPTION and 0
"Unable to load script".

**Note:** v1.0.0-preview was signed with an ephemeral CI debug key, so
v1.0.1 (new release key) requires uninstalling the old APK first.

**Validation:** expo-doctor 21/21 · tsc clean · eslint clean · 12/12 tests pass.

## M2 Plan — started 2026-09-26

Authorization: user mission dated 2026-09-26 — work directly in this repo.
Hard rules: free tiers only; never spend money, enable paid billing, publish
the app, or submit the competition entry without explicit approval. Never
commit secrets; never ask for private credentials in chat (use Secure Vault
/ dashboard flows).

### Audit (DONE 2026-09-26)
- `src/app/analyze.tsx`: 4-TF guided checklist (bias + POIs + screenshot +
  notes), deterministic synthesis, saves to journal. No AI yet.
- `src/lib/risk.ts`: pure deterministic calculator (ES/MES/NQ/MNQ/YM/MYM/
  RTY/GC/CL), warnings, tests in `risk.test.ts`. Must preserve + extend.
- `src/lib/journal.ts`: AsyncStorage entries (symbol/direction/entry/stop/
  target/contracts/resultR/notes/timeframeBias). Report can go in notes.
- `src/lib/purchases.ts`: react-native-purchases ^10.10.2, graceful
  degradation, NO key configured. Entitlement id `pro`.
- No Gemini SDK, no backend. Release signing: PKCS12 keystore in GitHub
  Secrets (see 2026-09-26 startup-fix entry).

### Phase 1 — Gemini integration
- [ ] IN PROGRESS: verify current Gemini API docs, pricing, free-tier models
- [ ] BLOCKED (user): Gemini API key (Google AI Studio) → backend secrets only
- [ ] BLOCKED (user): serverless account for the proxy (proposed: Cloudflare
      Workers free tier — key never touches the app)
- [ ] Worker: request validation, rate limits, image-size limits, timeouts,
      cost controls
- [ ] Structured JSON output + schema validation + honest error messages
- [ ] Graceful fallback when free limits hit (never fake analysis)
- [ ] Explicit in-app consent before sending screenshots

### Phase 2 — ICT multi-timeframe (Daily/1H/15M/1M)
- [ ] Instrument + date/session picker
- [ ] Per-TF analysis prompts (structure, liquidity, FVG/OB, MSS,
      displacement, invalidation per spec)
- [ ] OBSERVED / POSSIBLE / NOT VERIFIED separation; NO TRADE on conflict
- [ ] Educational final report; save to journal

### Phase 3 — Risk calculator upgrades
- [ ] Long/short, NQ/MNQ quick switch, commissions + slippage
- [ ] Max risk/trade, daily risk budget, prop drawdown (incl. trailing)
- [ ] Risk-based contract sizing; new warnings (spec section)
- [ ] Extend tests; keep existing tests green

### Phase 4 — RevenueCat production (target: Samsung Galaxy Store)
- [x] Verified: RevenueCat officially supports Galaxy Store (Samsung IAP);
      RN SDK ≥10.3.0 via `react-native-purchases-store-galaxy`
      (installed 10.10.2, commit 5c1b6d6)
- [x] `purchases.ts`: store `GALAXY`, TEST billing in dev / PRODUCTION in
      release, graceful no-key fallback; pro.tsx copy updated
- [x] tsc + lint + expo-doctor 21/21 + tests 22/22 green
- [x] BLOCKED (user) account+project DONE 2026-09-27: free account
      (kleiner2024@gmail.com), project "TRADEOS AI", Galaxy Store app
      (com.tradeosai.app), entitlement `pro` — all via guided setup
- [x] Public Galaxy key wired: GitHub secret
      EXPO_PUBLIC_REVENUECAT_GALAXY_KEY -> release workflow env
      (key is public-by-design; never in repo)
- [ ] BLOCKED (user): Samsung Seller Portal — Commercial Seller Status
      (**needs D-U-N-S number** + bank/PayPal; can take days — start NOW),
      register app, create monthly Pro subscription, activate it
- [ ] BLOCKED (user): in Seller Portal get Service Account ID + private key
      (API > Service Account) -> paste into RevenueCat Galaxy app config
- [ ] After Samsung product exists: add product to RevenueCat catalog,
      create current offering with monthly package attached to `pro`
- [ ] Real purchase test on a PHYSICAL Galaxy device (emulator billing
      unsupported) — user action
- [ ] Do NOT claim purchases work until tested

### Phase 5 — Release engineering
- [ ] Signing audit (keystore in Secrets, never in repo) — DONE for APK
- [ ] Verify target store format (APK vs AAB) for Galaxy Store
- [ ] Icon, screenshots, description, privacy policy, data safety, demo
      video, install instructions, release notes

### Phase 6 — Shipaton
- [ ] IN PROGRESS: verify current official rules + deadline
- [ ] Devpost submission prep; no eligibility claims until public +
      integration verified

## Research brief — Gemini API + Shipaton rules (verified 2026-09-26)

### Gemini API
- Recommended model: `gemini-3.8-flash` (stable flagship Flash, vision +
  JSON schema, 1M context). Fallback chain: 3.7 → 3.6 → 2.5-flash.
  `gemini-2.0-flash` is SHUT DOWN — do not use.
- Free tier (AI Studio): ~20 req/day on 3.8-flash (community-measured;
  official numbers only visible inside AI Studio). Free traffic shed first.
- Paid: $0.75/$3.75 per 1M in/out tokens thru Dec 31 2026; DOUBLES Jan 2027.
  One ICT report (4 screenshots + ~2k JSON out) ≈ $0.01–0.03.
- REST: POST generativelanguage.googleapis.com/v1beta/models/
  gemini-3.8-flash:generateContent; inlineData base64 images (≤20MB);
  generationConfig responseMimeType=application/json + responseSchema.
- JS SDK: `@google/genai` is current; `@google/generative-ai` deprecated.
  Worker: plain fetch() REST, key in Worker secret, never in app.

### Shipaton 2026 (official Devpost rules, fetched 2026-09-26)
- Deadline: **Sep 30, 2026 11:45 PM PDT**. Judging Oct 1–13, winners Oct 21.
- Stores: App Store, Google Play, OR Samsung Galaxy Store — Galaxy alone
  suffices. **GitHub APK does NOT qualify.** First PUBLIC store version must
  be released during Jul 31–Sep 30 2026 (our GitHub-only releases don't
  count, so a first Galaxy Store release is still eligible).
- RevenueCat: SDK must power ≥1 purchase (sandbox OK) + free trial or promo
  code for judges. Must be accessible from the US.
- Devpost needs: description, <2-min YouTube/Vimeo demo on-device,
  store listing URL, 1024×1024 icon, ≥1 screenshot 1179×2556 (no frame),
  trial/promo code.
- ⚠️ App review can take multiple days — submitting to Galaxy Store is the
  critical path. Do it ASAP.

### M2 checklist updates
- Phase 1 research: DONE. Model selected: gemini-3.8-flash.
- Phase 5: target format = Galaxy Store (APK accepted there; confirm at
  submission). Priority: store listing submission ASAP.

## Phase 1 — Gemini backend (2026-09-26/27, IN PROGRESS)

- Gemini API key connected via Secure Vault (user completed 2026-09-26).
  Key never in chat, never in repo.
- Skill `gemini` created (`~/workspace/skills/gemini/`): CLI calls
  generateContent via authd surrogate as x-goog-api-key header.
  Verified live: key works (API slow from here, ~60s/call).
- Model: gemini-3.8-flash, fallback 3.7 → 3.6 → 2.5-flash.
- Worker `workers/gemini-proxy/` (Cloudflare Workers, free tier):
  - POST /analyze { consent, instrument, session, images[] }, GET /health
  - Guards: consent required, 1–4 images, 5MB/image, 20MB total,
    per-IP 5 req/hour, global 20/day (env-tunable), 110s timeout,
    maxOutputTokens 3000, temperature 0.3
  - Model chain with 429/5xx fallback; honest errors, never fake analysis
  - `wrangler.toml`, README with deploy steps
  - Tests: `src/index.test.ts` 10/10 pass (validate + looksValidReport)
- ICT schema `ict-schema.json`: per-TF observed/possible/not_verified +
  synthesis + verdict (TRADE_CANDIDATE/NO_TRADE/INSUFFICIENT_DATA).
  Notes: $ref inlined (Gemini subset), $schema stripped (API rejects it).
- Prompt `src/prompt.ts`: per-TF ICT elements per spec, hard rules
  (never invent levels/timestamps/formations; NO_TRADE on contradiction).
- E2E validation: synthetic 4-TF NQ charts → live Gemini JSON test.
- BLOCKED: Cloudflare account (user) to deploy the Worker.

## Phase 2 app — AI analysis screen (2026-09-27, DONE pending emulator)

- `expo-file-system` installed via `npx expo install` (base64 screenshots).
- `src/lib/gemini.ts`: proxy client. No key in app; explicit consent param;
  honest GeminiError codes (no_consent/not_configured/network/rate_limited/
  unavailable/bad_response); verdictLine helper.
- `src/lib/journal.ts`: optional `aiReport` (stringified IctReport).
- `src/app/analyze.tsx` restructured:
  - Step 0: instrument picker (ES/MES/NQ/MNQ/YM/MYM/RTY) + session/date input
  - Steps 1–4: existing 4-TF checklist (bias/POI/screenshot/notes) preserved
  - Step 5: review + AI card (consent checkbox required, offline fallback
    message when proxy not configured) + verdict banner + per-TF
    observed/possible/not_verified + full synthesis + save AI report to
    journal (notes + timeframeBias + aiReport JSON)
- Checks: tsc 0 errors, 12/12 tests pass, expo lint clean, expo-doctor 21/21.
- Emulator cold-start run 36290681625 triggered (validates release build
  with the new native module).
- NOTE: AI button is inert until EXPO_PUBLIC_GEMINI_PROXY_URL is set and
  the Worker is deployed (needs user's Cloudflare account).

## Phase 3 — Risk calculator (2026-09-27, DONE)

- `src/lib/risk.ts`: `calculateRisk()` UNCHANGED (existing tests untouched).
  New `calculateAdvancedRisk()` wraps it:
  - long/short direction check (wrong-side stop → 0 contracts + warning)
  - commission (round-trip $) + slippage (ticks) in sizing and reporting
  - maxRiskPerTrade cap; remaining daily budget (warn + max fitting contracts)
  - prop drawdown: trailing or static, remaining + breach warnings
  - distant-stop heuristic (>2% of entry → warning)
  - base "too small → raise risk %" advice replaced with "do not raise risk"
  - instrument specs verified correct (ES/MES/NQ/MNQ/YM/MYM/RTY/GC/CL)
- `src/app/risk.tsx`: direction toggle, NQ/MNQ/ES/MES quick switch, full
  symbol chips, cost/limit/drawdown sections, budget+drawdown in results.
- Tests: 22/22 pass (12 pre-existing + 10 new advanced cases).
- Checks: tsc 0, expo lint clean.
