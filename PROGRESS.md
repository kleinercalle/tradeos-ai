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
