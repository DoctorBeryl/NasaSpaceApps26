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

## 2026-11-14: Alex (+ Claude): report screen, ship PA, and home-page VEGA pop-up
**Changed:** Added `report.html` (the team's Gemini EVA prototype: suit telemetry, radiation shelter timer, DCS R-value, body-map triage, 16-bit pixel companion), `js/crew.js` (`Crew`, `ShipPA`, `ReportBus`), `js/companion.js` + `css/companion.css` (home pop-up). `index.html` loads `vega.js`, `crew.js`, `companion.js`; `NAV_LINKS` has "Report".
**Decisions:** The pixel character is VEGA's face (one assistant, not two); the Gemini names A.S.T.R.A. and Cap-16 are gone from visible text. Every alert on the report screen is announced crew-wide on the "ship PA" with the astronaut's rank and name (chime, then `VEGA.speak`, so ElevenLabs when configured). Critical alerts repeat every 45 s while active. When the PA is on, the helmet voice stays quiet so two voices don't overlap. The home pop-up greets by name on every visit and fires a simulated hazard 25 s in and then every 75 s, but only while no `report.html` tab is open (1 s heartbeats on BroadcastChannel `astrasight-report`). Its "Open report screen" link passes `?scenario=` so the report opens on the same hazard. `report.html` was dropped in as-is at the user's request, so it uses the Tailwind CDN and its own styles, unlike the rest of the site.
**Open / next:** The Gemini thresholds (R-value cut-offs, 25 mSv shelter limit, 4.3 PSI suit) haven't been checked against NASA sources; run them past `space-health-research` before judges see them. The leftover scuba functions in `report.html` are dead code. Restyling `report.html` with our tokens is optional.
**Gotchas:** The Gemini share page renders client-side, but the conversation and prototype HTML can be fetched: GET the share page for `cfb2h`/`FdrFJe`, then POST `batchexecute?rpcids=ujx1Bf` with `f.req=[[["ujx1Bf","[null,\"<share id>\",[4]]",null,"generic"]]]`. Browsers block sound until the visitor clicks something, so the home pop-up only speaks after the first interaction (the text always shows).

## 2026-11-14: Alex (+ Claude): VEGA AI backend on Qwen 2.5 (Ollama)
**Changed:** Added `server/` (`ollama.js` client, `registry.js` loads `js/data.js` in a sandbox, `onboarding.js` questionnaire and tailoring, `ai.js` routes, `persona.md`), mounted in `server.js` under `/api/ai/*`. Added `OLLAMA_*` to `.env.example`, a README note, and the API contract in `docs/AI-BACKEND.md`. `server.js` no longer serves `server/` as static files.
**Decisions:** Backend only. Login (Firebase plus face recognition), the tutorial, the questionnaire UI, the chat sidebar, and the critical-stats screen are for other agents and code against `docs/AI-BACKEND.md`. The backend is stateless: the client stores the profile and sends it with each call. The default model is `qwen2.5:3b` so it runs on laptops; set `OLLAMA_MODEL=qwen2.5:7b` for better answers. The questionnaire is a fixed bank of 11 questions (it works without the model); Qwen extracts fields from free text and may ask one follow-up. Zones and escalation are computed in code from `js/data.js`, never by the model. Personal caution lines can move at most halfway toward the danger line and are marked `proposed` (our proposal, not a NASA rule ⚠️).
**Open / next:** Verify Firebase ID tokens in `server/ai.js` `handle()` once login exists. Replace `server/persona.md` with the team's Gemini persona (the share link renders client-side, so its text couldn't be fetched). Test with real Qwen output: so far it's been tested against a mock Ollama and with Ollama offline.
**Gotchas:** Ollama structured outputs (the JSON schema in `format`) need Ollama 0.5 or later. The first request after the model loads is slow (10–30 s on CPU); `keep_alive` is 30 m. The brief takes several seconds, so don't call it on every vitals tick.

## 2026-11-14: Alex (+ Claude): VEGA AI backend, round 2 (persona, EVA context, sign-in)
**Changed:** `server/persona.md` now follows the Gemini prototype's companion (pixel EVA buddy, nominal/caution/critical tone, symptom cross-check against telemetry). `/api/ai/chat` and `/api/ai/brief` take an optional `context` object (labelled extra telemetry, such as EVA suit data from `report.html`). In Firebase mode, `/api/ai/*` requires `Authorization: Bearer <AstraAuth.getIdToken()>` through `server/auth.js` `userFromRequest()`; local mode stays open, and `AI_REQUIRE_AUTH=0` turns the check off. `server/ai.js` loads `server/auth.js` only if it exists.
**Decisions:** `context` values reach the model but never set `escalate`, because only `TOOLS` readings have vetted limits.
**Discrepancy:** `report.html`'s triage chat prints "PROBABLE TYPE II DCS" and similar diagnoses from keyword rules, against the "VEGA flags, never diagnoses" rule in CLAUDE.md and the persona. Left as is for the team to decide. The suggested fix is to route it through `/api/ai/chat` with `context`.
**Gotchas:** On this machine the winget Node install needs a UAC prompt (exit code 1602 when it's declined). A per-user zip in `%LOCALAPPDATA%\Programs` works without admin.
