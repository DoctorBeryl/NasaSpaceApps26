# Session history

A handoff log shared by everyone's Claude Code sessions. **Append only, newest at the bottom.** See "Session history protocol" in [CLAUDE.md](../CLAUDE.md).

Public repo: no secrets, emails, personal paths, or private conversations here. Use GitHub handles or first names.

### Entry template

```
## YYYY-MM-DD: <handle> (+ Claude): <one-line summary>
**Changed:** files/features touched
**Decisions:** what was decided and why
**Open / next:** TODOs someone else can pick up
**Gotchas:** anything that wasted time or will bite the next person
```

---

## 2026-11-14: initial site (`websitelayout1`)
**Changed:** Built the static AstraSight site: `index.html`, `interface.html` (HUD with simulated vitals, dockable side panel, VEGA voice and typed commands), `tools.html` (8 diagnostic demos with procedural signals and a `media/<id>.mp4` override), `vega.html` (intent-parser console), shared `css/styles.css`, and `js/*`.
**Decisions:** No build step and no dependencies. All data is simulated. Eight sensor-based tools are defined in `js/data.js`.
*(Entry written after the fact from the commit.)*

## 2026-11-14: Alex (+ Claude): repo set up for multi-instance collaboration
**Changed:** Added `CLAUDE.md`, `docs/HISTORY.md`, `docs/CHALLENGE.md` (official brief, research, gap analysis), and `.gitignore`. Added project skills in `.claude/skills/`: `frontend-design` and `webapp-testing` (vendored from `anthropics/skills` @ `2c5958e`, Apache-2.0) and a custom `space-health-research` skill.
**Decisions:** The challenge is "Create Health Monitoring Software for Astronauts on Space Missions". Shared context lives in committed docs; personal context lives in gitignored `CLAUDE.local.md` and `.claude/settings.local.json`.
**Open / next:** Work through the gap analysis in `docs/CHALLENGE.md`. Highest value first: add BP, blood sugar, sleep, and mood (with a manual check-in UI); per-indicator guidance (explain / hazard / actions / escalate); a clickable body figure; mission-day trend charts. Verify the ⚠️ facts in CHALLENGE.md against NASA and CSA pages.
**Gotchas:** spaceappschallenge.org renders client-side, so a plain fetch shows no challenge text (the text is in the embedded Next.js payload). On some machines Node isn't installed; use `python -m http.server`.

## 2026-11-14: Alex (+ Claude): research on NASA phenotyping and smart handrails
**Changed:** Added `docs/research/smart-handrails.md` (NASA Standard Measures, CIPHER, SOMA; evidence for grip, ECG, PPG, and microbes on handrails; "rail session" concept; RIDGE mapping; limits; integration plan). Appended a summary section to `docs/CHALLENGE.md`. No code changes.
**Decisions:** Frame the idea as *continuous, passive in-flight phenotyping* that complements NASA's episodic Standard Measures and CIPHER. The rail pairs to the wearer's glasses, with no fingerprint or vein ID. A single sample never alerts; only trends against a personal baseline do.
**Open / next:** If the team approves, add a `grip` tool to `TOOLS`, VEGA aliases, a simulated "rail session" on the HUD, and a tools-page stage. Verify the ⚠️ items (Lefèvre 2026 numbers, EDA and bioimpedance evidence) before the pitch. The escalation thresholds (15% for 14 days) are our proposal, not NASA's.
**Gotchas:** nasa.gov doesn't use the phrase "deep phenotyping"; say "Standard Measures / CIPHER" to judges.

## 2026-11-14: Alex (+ Claude): VEGA AI backend on Qwen 2.5 (Ollama)
**Changed:** Added `server/` (`ollama.js` client, `registry.js` loads `js/data.js` in a sandbox, `onboarding.js` questionnaire and tailoring, `ai.js` routes, `persona.md`), mounted in `server.js` under `/api/ai/*`. Added `OLLAMA_*` to `.env.example`, a README note, and the API contract in `docs/AI-BACKEND.md`. `server.js` no longer serves `server/` as static files.
**Decisions:** Backend only. Login (Firebase plus face recognition), the tutorial, the questionnaire UI, the chat sidebar, and the critical-stats screen are for other agents and code against `docs/AI-BACKEND.md`. The backend is stateless: the client stores the profile and sends it with each call. The default model is `qwen2.5:3b` so it runs on laptops; set `OLLAMA_MODEL=qwen2.5:7b` for better answers. The questionnaire is a fixed bank of 11 questions (it works without the model); Qwen extracts fields from free text and may ask one follow-up. Zones and escalation are computed in code from `js/data.js`, never by the model. Personal caution lines can move at most halfway toward the danger line and are marked `proposed` (our proposal, not a NASA rule ⚠️).
**Open / next:** Verify Firebase ID tokens in `server/ai.js` `handle()` once login exists. Replace `server/persona.md` with the team's Gemini persona (the share link renders client-side, so its text couldn't be fetched). Test with real Qwen output: so far it's been tested against a mock Ollama and with Ollama offline.
**Gotchas:** Ollama structured outputs (the JSON schema in `format`) need Ollama 0.5 or later. The first request after the model loads is slow (10–30 s on CPU); `keep_alive` is 30 m. The brief takes several seconds, so don't call it on every vitals tick.

## 2026-11-14: Alex (+ Claude): git sync protocol for many instances
**Changed:** `CLAUDE.md`: added "Git sync protocol" (check before pulling, resolve conflicts as a union, find silent discrepancies, verify, check before pushing). Updated "Stack and running" to describe the Node `server.js` + Ollama setup; it still said "static site, no dependencies".
**Decisions:** Merge instead of rebase. Stage only your own files, because several instances can share one working folder. No force-push, reset, stash, or clean. Genuine contradictions get a "Discrepancy" note in HISTORY and go to the user to decide.
**Gotchas:** On the shared machine, other instances' uncommitted work sits in the same working tree. `git add -A` would commit their half-finished changes under your name.

## 2026-11-14: Alex (+ Claude): report screen, ship PA, and home-page VEGA pop-up
**Changed:** Added `report.html` (the team's Gemini EVA prototype: suit telemetry, radiation shelter timer, DCS R-value, body-map triage, 16-bit pixel companion), `js/crew.js` (`Crew`, `ShipPA`, `ReportBus`), `js/companion.js` + `css/companion.css` (home pop-up). `index.html` loads `vega.js`, `crew.js`, `companion.js`; `NAV_LINKS` has "Report".
**Decisions:** The pixel character is VEGA's face (one assistant, not two); the Gemini names A.S.T.R.A. and Cap-16 are gone from visible text. Every alert on the report screen is announced crew-wide on the "ship PA" with the astronaut's rank and name (chime, then `VEGA.speak`, so ElevenLabs when configured). Critical alerts repeat every 45 s while active. When the PA is on, the helmet voice stays quiet so two voices don't overlap. The home pop-up greets by name on every visit and fires a simulated hazard 25 s in and then every 75 s, but only while no `report.html` tab is open (1 s heartbeats on BroadcastChannel `astrasight-report`). Its "Open report screen" link passes `?scenario=` so the report opens on the same hazard. `report.html` was dropped in as-is at the user's request, so it uses the Tailwind CDN and its own styles, unlike the rest of the site.
**Open / next:** The Gemini thresholds (R-value cut-offs, 25 mSv shelter limit, 4.3 PSI suit) haven't been checked against NASA sources; run them past `space-health-research` before judges see them. The leftover scuba functions in `report.html` are dead code. Restyling `report.html` with our tokens is optional.
**Gotchas:** The Gemini share page renders client-side, but the conversation and prototype HTML can be fetched: GET the share page for `cfb2h`/`FdrFJe`, then POST `batchexecute?rpcids=ujx1Bf` with `f.req=[[["ujx1Bf","[null,\"<share id>\",[4]]",null,"generic"]]]`. Browsers block sound until the visitor clicks something, so the home pop-up only speaks after the first interaction (the text always shows).

## 2026-11-14: Alex (+ Claude): face sign-in with Firebase Auth
**Changed:** Added `login.html` + `js/login.js` (face scan, enrollment), `js/auth.js` (`window.AstraAuth`: session, profile in Firestore `users/{uid}` with a localStorage fallback, nav name chip, `[data-auth-name]`), `server/auth.js` (`/api/auth/*`, mounted in `server.js`), `firestore.rules`, and `docs/AUTH.md` (contract plus setup). Added `auth.js` to every page, including `report.html`. The HUD's `CREW` corner shows the signed-in name. Added `FIREBASE_*` to `.env.example`, ignored `server/data/` and service-account JSON, and appended sign-in styles to `css/styles.css`. `CLAUDE.md` now has the team's product flow (sign-in → tutorial + questionnaire → chat sidebar, plus a separate critical-stats screen).
**Decisions:** Face recognition is `@vladmandic/face-api` 1.7.15 (MIT; maintained fork of face-api.js) from jsDelivr. It runs in the browser, and only 128-number descriptors go to the server; images never do. Matching is server-side: median of nearest-template Euclidean distances, accepted below 0.5. The server mints Firebase **custom tokens** with Node `crypto` (no `firebase-admin`, so still no npm deps); the browser calls `signInWithCustomToken`. Without `FIREBASE_*` in `.env` it runs in **local mode** (same matching, session in localStorage), so demos work offline. Liveness is a head turn (nose vs. jaw from the landmarks): it blocks photos but not videos, and we say so. New crew land on `interface.html?welcome=1` with `onboarded: false`. Pages are **not** gated yet; call `AstraAuth.requireAuth()` to gate one.
**Open / next:** Onboarding agent: check `AstraAuth.needsOnboarding()`, and finish with `saveProfile({ profile, onboarded: true })`. AI agent: `require("./auth").userFromRequest(req)` verifies `Authorization: Bearer <AstraAuth.getIdToken()>` (Firebase mode only). Someone with console access needs to create the Firebase project, fill in `.env`, and paste `firestore.rules`; Firebase mode is only tested with a throwaway key (token format and signature check pass), not against live Firebase. Self-host the face models (`FACE_MODEL_URL`) if the venue Wi-Fi is bad.
**Gotchas:** Face templates live per machine in `server/data/faces.json`, so enroll on the demo laptop. Manage them with `node server/auth.js list|remove|reset`. In headless Chromium without a GPU, the first face pass takes about 25 s and later ones about 2 s each; on a laptop GPU it's near real time. To test without a webcam, use Chromium's `--use-file-for-fake-video-capture=<clip>.y4m`.

## 2026-11-14: Alex (+ Claude): VEGA AI backend, round 2 (persona, EVA context, sign-in)
**Changed:** `server/persona.md` now follows the Gemini prototype's companion (pixel EVA buddy, nominal/caution/critical tone, symptom cross-check against telemetry). `/api/ai/chat` and `/api/ai/brief` take an optional `context` object (labelled extra telemetry, such as EVA suit data from `report.html`). In Firebase mode, `/api/ai/*` requires `Authorization: Bearer <AstraAuth.getIdToken()>` through `server/auth.js` `userFromRequest()`; local mode stays open, and `AI_REQUIRE_AUTH=0` turns the check off. `server/ai.js` loads `server/auth.js` only if it exists.
**Decisions:** `context` values reach the model but never set `escalate`, because only `TOOLS` readings have vetted limits.
**Discrepancy:** `report.html`'s triage chat prints "PROBABLE TYPE II DCS" and similar diagnoses from keyword rules, against the "VEGA flags, never diagnoses" rule in CLAUDE.md and the persona. Left as is for the team to decide. The suggested fix is to route it through `/api/ai/chat` with `context`.
**Gotchas:** On this machine the winget Node install needs a UAC prompt (exit code 1602 when it's declined). A per-user zip in `%LOCALAPPDATA%\Programs` works without admin.

## 2026-11-14: Alex (+ Claude): sign-in choice (face scan or email and password); Firebase live
**Changed:** `login.html` now opens on a method choice. Choosing face scan shows a notice that face data is stored locally on this device and is for demo purposes only; the camera turns on only after that choice. Email and password uses Firebase Email/Password (create account, sign in, reset email) through new `AstraAuth.signInWithPassword / createAccount / resetPassword`. The last method used is remembered in localStorage (`astrasight.loginMethod`). Face flows now cancel cleanly when you switch method, and release the camera. Updated `docs/AUTH.md` and `CLAUDE.md`.
**Decisions:** Face templates stay in `server/data/faces.json` on the machine running the server, not in Firestore, so they never reach the cloud ("local, demo only"). Password sign-in is Firebase's own provider, so we never handle password hashes. Face and password accounts are separate users.
**Verified:** Live against the team Firebase project: custom-token sign-in, own `users/{uid}` read and write, other users' docs and unauthenticated reads denied (rules work), `verifyIdToken`. Test user and doc deleted. Playwright: method choice, password tabs and errors, remembered method, camera released when switching, 390 px layout with no horizontal scroll.
**Open / next:** Enable **Email/Password** in the Firebase console (Authentication → Sign-in method); until then the page says it isn't turned on. The onboarding tutorial and questionnaire UI doesn't exist yet: `/api/ai/onboard/*` has no frontend, and nothing handles `interface.html?welcome=1`.
