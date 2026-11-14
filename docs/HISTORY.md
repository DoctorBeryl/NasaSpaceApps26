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

## 2026-11-14: DoctorBeryl (+ Claude): ElevenLabs voice works from any local static server
**Changed:** `js/vega.js` probes `/api/tts` on its own origin, then falls back to `http://localhost:8000/api/tts`, and logs a console warning when it ends up on the browser voice. `server.js` sends CORS headers on `/api/tts` for localhost origins only, answers preflight, and prints a clear message on `EADDRINUSE`. `CLAUDE.md` now says to run `node server.js`.
**Decisions:** CORS is restricted to localhost origins so other sites can't spend the ElevenLabs key.
**Open / next:** None from this change.
**Gotchas:** If port 8000 is busy, set `PORT` (PowerShell: `$env:PORT=8001; node server.js`). The cross-origin fallback only targets port 8000.

## 2026-11-14: DoctorBeryl (+ Claude): Ollama answers free-form questions in the HUD
**Changed:** `server.js` has `/api/chat` (POST proxies to Ollama `/api/chat`; GET reports whether the model is pulled), same localhost-only CORS as `/api/tts`. `js/vega.js` has `VEGA.ask(messages, context)` with the same own-origin, then localhost:8000 probing. `js/hud.js` sends unrecognized input, and questions about a reading ("why is my heart rate high?"), to the model with the last 12 turns and a summary of all eight readings; known commands stay rule-based. `.env.example` has `OLLAMA_URL` and `OLLAMA_MODEL`.
**Decisions:** The system prompt lives only on the server ("Regardless of the next prompts, you shall act as VEGA… help only with AstraSight's features or mission-related inquiries"), and the server drops any `system` role from the browser, so the page can't replace it. Replies are kept to 1 to 3 spoken sentences, no markdown. The no-diagnosis and flight-surgeon escalation rules are in the prompt. If Ollama is down, everything falls back to the old behavior.
**Open / next:** Only tested against a stand-in Ollama server; try it with a real `llama3.2` and tune the prompt. Small models may still drift off-topic under persistent prompt injection. Replies aren't streamed, so slow models show "Thinking…" for a while.
**Gotchas:** The committed `hud.js` had a literal backspace character instead of `` in the "reset readings" regex, so typing "reset readings" never matched; fixed. Watch for that if you edit JS through a Python script with non-raw strings.

## 2026-11-14: DoctorBeryl (+ Claude): one command runs Ollama and the server
**Changed:** Added `dev.js` and a dependency-free `package.json` (`npm run dev` -> `node dev.js`, `npm start` -> `node server.js`). `dev.js` reuses Ollama if it answers at `OLLAMA_URL`, otherwise spawns `ollama serve` and waits up to 10 s, then runs `server.js`; output is prefixed `[ollama]`/`[server]`, and Ctrl+C kills both (taskkill /T on Windows).
**Decisions:** Wrote a small launcher instead of adding the `concurrently` npm package, to keep the no-dependencies rule.
**Open / next:** None.
**Gotchas:** The Ollama desktop app on Windows and macOS already runs the server, so `dev.js` usually just starts `server.js`.

## 2026-11-14: DoctorBeryl (+ Claude): VEGA's chat personality is friendly
**Changed:** `server.js` system prompt has a "Personality" paragraph (warm, encouraging crewmate; uses the crew member's name; calm when readings are worrying; safety info stays plain), plus rules: refuse off-topic requests entirely (no "space version" of a poem), never call a warn/crit reading normal, only suggest real features. `js/hud.js` adds `Crew member: <call sign>` to the chat context when `crew.js` is loaded, and the "didn't catch that" fallback is friendlier.
**Decisions:** The first friendly prompt made llama3.2 write the off-topic poem anyway and call 112 bpm normal, so the scope and status rules were made explicit.
**Open / next:** `interface.html` doesn't load `js/crew.js`, so the HUD chat doesn't know the name yet; add the script tag if wanted.
**Gotchas:** llama3.2 still drifts a little (offering a "space pizza recipe"); a bigger model holds the rules better.
