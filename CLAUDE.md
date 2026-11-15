# CLAUDE.md

Shared instructions for every Claude Code instance working on this repo. This file is committed, and **the repo is public**. Read "Public repo rules" before you write anything.

## What this is

**AstraSight**, our NASA Space Apps Challenge 2026 entry for **"Create Health Monitoring Software for Astronauts on Space Missions"**. It's a concept website for smart glasses with an in-lens health HUD (a side panel) and **ASTRA**, an on-device voice assistant that reads vitals, explains them, and suggests actions.

- **Naming:** the assistant is **ASTRA** (Astronaut Support, Triage & Response Assistant). It was called VEGA until Nov 15. All user-visible text, the AI persona and the server prompts say ASTRA, and the wake word accepts both "ASTRA" and "VEGA". Code identifiers keep the old name on purpose, so no one's work breaks: `window.VEGA` / `VEGA.speak()`, `js/vega.js`, `vega.html`, `VegaBuddy`, `VegaAlerts`, and `.vega-*` CSS classes. Use ASTRA in new copy; don't rename identifiers.
- Challenge page: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- The hackathon runs **Nov 14–15, 2026**. Time is short: favor working demos over refactors.
- The full brief, research notes, and a gap analysis against the brief are in [docs/CHALLENGE.md](docs/CHALLENGE.md). **Read it before making product decisions.**
- What earlier sessions did, decided, and left open is in [docs/HISTORY.md](docs/HISTORY.md). **Read the latest entries first, and append your own entry at the end of your session** (see "Session history protocol").

### Product flow (team plan, Nov 14)

Several agents build these in parallel. Each piece has a contract doc; code against it, not against another agent's internals.

1. **Sign-in:** face recognition (open-source face-api.js) plus Firebase Auth. New crew enter only a name and do a face scan. Done: `login.html`, `js/auth.js` (`window.AstraAuth`), and `server/auth.js`. See [docs/AUTH.md](docs/AUTH.md).
2. **First visit:** after enrolling, crew land on `interface.html?welcome=1` with `onboarded: false` in their profile. Show a **tutorial** on using the site plus ASTRA's **AI questionnaire**, which tailors baselines to that astronaut. When it's done, call `AstraAuth.saveProfile({ profile, onboarded: true })`.
3. **AI backend:** Ollama running **Qwen 2.5**, behind `/api/ai/*` (onboarding, chat, brief). See [docs/AI-BACKEND.md](docs/AI-BACKEND.md). Its persona (`server/persona.md`) is the ASTRA persona from the team's Gemini prototype.
4. **Chat:** after tailoring, the ASTRA chatbox is a **sidebar** available across the site (`/api/ai/chat`).
5. **Critical-stats screen:** a *separate* feature from the chat. It's the ASTRA persona's screen for visualizing critical stats (`report.html`, `/api/ai/brief`).

## Stack and running

The frontend has no build step: plain HTML, CSS, and vanilla JS loaded with `<script>` tags. The backend is `server.js`, Node 18+ with **no npm dependencies**. Keep both that way unless the team decides otherwise, and record that decision in HISTORY.

```sh
cp .env.example .env      # add keys locally; .env is gitignored, never commit it
ollama pull qwen2.5:3b    # for ASTRA's AI routes (see docs/AI-BACKEND.md)
ollama pull medgemma1.5:4b   # medical model for body-map triage on report.html
node server.js            # Node 18+, http://localhost:8000: static site + /api/*
npm run dev               # same, plus starts Ollama first if it isn't running (dev.js)
# frontend only, no AI or TTS:  python -m http.server 8000
```

`server.js` serves the site and proxies ASTRA's voice to ElevenLabs (`/api/tts`; it tries `ELEVENLABS_API_KEY` from `.env` first, then the shared keys in `server/elevenlabs-key.js`, and switches to the next key when one runs out of credits or is rejected). Other static servers (`npx serve`, `python -m http.server`, Live Server) still get the ElevenLabs voice as long as `node server.js` is also running on port 8000: ASTRA falls back to `http://localhost:8000/api/tts`, and the server allows CORS from localhost origins only. If neither is reachable (or on `file://`), ASTRA uses the browser's robotic voice and logs a console warning.

Free-form questions in the HUD's command box go to a local [Ollama](https://ollama.com) model through `server.js` (`/api/chat`; set `OLLAMA_URL` and `OLLAMA_MODEL` in `.env`, default `qwen2.5:3b`, the same model as `/api/ai/*`). The system prompt is fixed in `server.js` and keeps ASTRA on AstraSight features and mission topics; the page sends only the conversation and the current simulated readings. Built-in commands are still handled by the rule-based parser. Without Ollama, questions get the built-in answer or "didn't catch that".

Voice input (Web Speech API) needs a secure origin (localhost counts) and Chrome or Edge. Typed commands work everywhere. Without the server or keys, ASTRA falls back to the browser's built-in voice.

| File | Role |
|------|------|
| `index.html` | Landing page: product, the 8 tools, intro to ASTRA |
| `interface.html` + `js/hud.js` | Interactive lens HUD: simulated vitals, dockable side panel, voice and typed commands, alerts |
| `tools.html` + `js/tools.js` | One demo stage per tool: procedural signal canvas, swapped for `media/<id>.mp4` if that file exists |
| `vega.html` + `js/vega.js` | ASTRA's rule-based intent parser (`VEGA.parse(text) → {intent, slots, confidence}`) and speech in/out. `vega.html` is no longer in the nav: the nav "?" opens the ASTRA guide, which links to it |
| `report.html` | Report screen (the team's "EVA-MED HUD" prototype): habitat/IVA and EVA modes, EVA clocks (time outside, plus a countdown that appears when a reading needs action), suit telemetry with manual override (sliders show low and high hazard lines from `LIMITS`; suit pressure hidden in the habitat), DCS risk heuristic, radiation shelter window, crew and habitat sensor modules, body-map triage with a rule-based review plus a ASTRA medical AI note (`/api/ai/triage` on MedGemma 1.5 4B, falling back to Qwen, with telemetry and EVA clocks as context: possible causes to consider, what to check next, escalation; never a diagnosis), three tabs (internal view keys in brackets): **Ship display** (`dual`, habitat telemetry plus triage for your role), **EVA HUD** (`eva`, the visor; switches to EVA mode), **Medical bay** (`ship`, triage full width, with no scenario or suit-control strip), and **Suit check** (`suits`). Suit check shows the sensor health of suits EMU-1 to EMU-4: no signal, impossible reading, stuck, primary/backup O₂ disagreement, noise, out of checkout range, and calibration overdue. A failed life-support sensor makes the suit **NO-GO**, which blocks CABIN EXIT for its wearer and names the exact sensor and suit, and ASTRA offers a spare suit that passes. It also has demo fault injection, and ASTRA wears an engineer's outfit there. A **Signed in as Crew / CMO** demo switch in the header sets the role for the whole page. Crew see only their own record. The Crew Medical Officer gets a compact crew roster on the Ship display. In the Medical bay the CMO gets the full console: a roster of 5 crew (4 simulated), every record, a whole-crew body-map heatmap with ASTRA's pattern notes, and Send to flight surgeon; ASTRA becomes "DR. ASTRA" in a lab coat there only. `?role=cmo` and `?view=display|eva|medical|suits` open these directly. ASTRA as a 16-bit pixel companion (hold and drag to park her, and she stays parked even during alerts; unparked, she moves next to what she's talking about; double-click her portrait to unpark her), crew profile and ship-wide PA log. Uses the Tailwind CDN, unlike the rest of the site. It loads `js/common.js` for the shared site nav and starfield, but not `styles.css` (whose `.btn`, `.chip` and `.panel` would clash), so the nav styles are copied into its `<style>` and scoped to `#site-nav` |
| `imca.html` + `js/imca.js` | IMCA (Intelligent Medical Crew Assistant): a 5-step consult for the crew medical officer (complaint, OPQRST questions plus red flags, vitals from `TOOLS`, ASTRA's assessment via `/api/ai/triage`, a SOAP note sent with the MedLink delay, follow-up questions via `/api/ai/chat`). Red flags and escalation are rules in code. Works without the server, minus the AI steps. Not in the nav (removed Nov 15 on Alex's request); open it by URL |
| `ultrasound.html` + `js/ultrasound.js` | Guided ultrasound (a VULCAN / ESA EchoFinder-2 style concept): drag, turn and tilt a probe on a body outline toward a stored per-organ target (kidney, heart, lungs, bladder). ASTRA gives one instruction at a time, the procedurally generated scan sharpens as the probe lines up, a clear frame (80 % or better, held 1.2 s) auto-saves and can be sent to the flight surgeon. Fully client-side, no AI or server |
| `js/medlink.js` + `css/medbay.css` | `MedLink`: mission picker (ISS, lunar, Mars) and one-way light-time countdown for "send to the flight surgeon", shared by IMCA and the ultrasound page; `medbay.css` holds both pages' components (loaded after `styles.css` and `arcade.css`) |
| `js/crew.js` | `Crew` (rank and name for alerts. The name comes only from sign-in: the questionnaire's `profile.callsign`, else the enrolled name. Without sign-in the user is a guest with no name, and ASTRA never asks for one), `ShipPA.announce()` (chime plus crew-wide spoken alert via `VEGA.speak`), `ReportBus` (report-screen heartbeat across tabs); `ShipPA.ack()` stops the voice and forgets the current alert, and turning the PA on re-reads the current alert from the start |
| `js/onboarding.js` | First-visit questionnaire overlay on `interface.html?welcome=1` (or `?onboard=1` to rerun): ASTRA asks the `/api/ai/onboard/*` questions one at a time; every answer can be typed or spoken (mic button, Web Speech API, matches spoken words to choice options); ends with a short tour and `AstraAuth.saveProfile({ profile, onboarded: true })` |
| `js/glasses3d.js` | Home-page 3D EVA helmet (three.js 0.160.0 UMD from jsDelivr, procedural, no model files; file keeps its old name), modelled on a spacewalk helmet: white hard shell with a rounded visor opening (alpha masks painted in phi/theta space), raised gold sun visor, clear bubble, live mini vitals display in the visor on the wearer's right, helmet lights with a camera, visor pivot hubs with the left and right buttons, scroll knob on the right hub, metal neck ring. Reflections from a procedural PMREM studio environment. Callout arrows to the buttons, knob and visor display fade when the part faces away; drag to rotate, falls back to text cards without WebGL |
| `js/companion.js` + `css/companion.css` | ASTRA "?" in the corner of the home, diagnostics and ASTRA pages: clicking it opens the same ASTRA guide as the nav "?" (`AstraHelp`); `VegaBuddy.explain()` (`greet()` is an alias). Drag the "?" to move it, or let go mid-drag to throw it: it glides, bounces off the screen edges, and the alert bubble flips to the side with room. Position is saved per browser (`astrasight.astra.pos`). Double-click sends it home, and arrow keys move it. No background events: `VegaBuddy.fireHazard()` (the diagnostics page's "Random health event" button) shows a random simulated hazard. Alert bubbles have Acknowledge (`ShipPA.ack()`: stops the voice). Hidden while `report.html` is open in another tab, unless an event is forced |
| `js/data.js` | **Single source of truth** for the tools: `TOOLS[]` (id, unit, base, jitter, warn thresholds, sensor, steps, voice cmd, wave type) and `ICONS` |
| `js/common.js` | Shared nav and footer (`NAV_LINKS`: Home, Interface, Diagnostics, Report, Ultrasound), the nav "?" and `AstraHelp` (the ASTRA guide panel: who ASTRA is, the 6-step pipeline, a try-a-command box using `VEGA.parse` when vega.js is loaded, what you can say, ground rules, link to vega.html; its CSS is injected so it also works on report.html), starfield, `.reveal` scroll-in, `drawSpark()` |
| `server.js` + `server/` | Node dev server (no deps): static files, `/api/tts` (ElevenLabs), `/api/ai/*` (ASTRA on Qwen 2.5 via local Ollama; the first-visit questionnaire uses Gemini Flash via `server/gemini.js` when `GEMINI_API_KEY` is set, falling back to Qwen; triage always uses MedGemma). API contract in [docs/AI-BACKEND.md](docs/AI-BACKEND.md); persona in `server/persona.md` |
| `build-static.js` | `npm run build:static`: copies the frontend into gitignored `dist/` plus a real `404.html`, for the static preview on Cloudflare Pages (build command `node build-static.js`, output `dist`). No backend there: no AI, sign-in, or ElevenLabs |
| `deploy/oracle-setup.sh` | One-shot setup of the full site on an Oracle Cloud Always Free ARM server: Node, Ollama with both models kept loaded, `astrasight` systemd service, pull from `main` every 10 min, Cloudflare Tunnel. Guide in [docs/DEPLOY-ORACLE.md](docs/DEPLOY-ORACLE.md) |
| `dev.js` + `package.json` | `npm run dev`: starts Ollama if it isn't already running, then `server.js` (no npm deps) |
| `login.html` + `js/login.js` | Sign-in: choose face scan (face-api.js in the browser; only 128-number descriptors go to the server; "stored locally, demo only" notice) or Firebase email and password |
| `js/auth.js` | `window.AstraAuth`: session, `requireAuth()`, profile storage (Firestore `users/{uid}`, localStorage fallback), nav name chip, `[data-auth-name]` |
| `server/auth.js` | `/api/auth/*`: face matching, templates in gitignored `server/data/faces.json`, Firebase custom tokens signed with `crypto`, `userFromRequest()` ID-token check. Firebase settings come from `.env`; without them it runs in local mode. See [docs/AUTH.md](docs/AUTH.md) |
| `css/arcade.css` | Arcade skin matching `report.html` (flat neon cyan/pink/amber/green, pixel grid and scanlines, corner-bracket panels, Press Start 2P accents). Loaded after `styles.css` (and `companion.css`) on `index.html` and `tools.html` only; it overrides the `:root` tokens, so other pages are unaffected |
| `css/styles.css` | Design tokens in `:root` (dark space theme: cyan, violet, magenta, plus ok/warn/crit) and all components |

Script load order matters: `data.js` → `common.js` → `auth.js` → `vega.js` → page script.

## Conventions

- **To add a health indicator**, add an entry to `TOOLS` in `js/data.js` first. The HUD, the tools page, and the home grid all render from it. Then add aliases in `TOOL_ALIASES` in `js/vega.js` so voice can reach it, and optionally a `wave` renderer in `js/tools.js`.
- **To add a page**, copy an existing page's `<head>`, include `<nav id="site-nav">` and `<footer id="site-footer">`, and register it in `NAV_LINKS`.
- Use the existing CSS tokens (`--cyan`, `--ok`, `--warn`, `--crit`, `--surface`, …). Don't hard-code new colors. Status colors: ok = green, warn = amber, crit = red, matching the brief's "color coding at a glance".
- Respect `prefers-reduced-motion`; `starfield()` already does.
- All health data is **simulated**. Keep the "Concept prototype · Simulated data · Not a medical device" disclaimer. ASTRA *flags and suggests* but never diagnoses, and serious findings escalate to the flight surgeon. This is part of the pitch and part of the brief.
- Copy is plain and specific: active voice, sentence case, no hype.
- Before claiming a UI change works, run it and check it with the `webapp-testing` skill (Playwright screenshots).

## Skills in this repo (`.claude/skills/`)

These are committed, so every collaborator's Claude Code loads them automatically.

| Skill | Use it for |
|-------|------------|
| `space-health-research` | Any health or medical content: which indicators, normal ranges, NASA hazards and risks, thresholds for flight-surgeon escalation, countermeasures. Cite sources. |
| `frontend-design` | New pages, or a visual redesign of an existing one (imported from `anthropics/skills`, Apache-2.0) |
| `webapp-testing` | Driving the site in headless Chromium to verify behavior and take screenshots (imported from `anthropics/skills`, Apache-2.0). Needs `pip install playwright && playwright install chromium`. |
| `git-sync` | Runs the Git sync protocol below on its own: fetch, commit your own files, `pull --no-rebase`, resolve conflicts as a union, verify, push. Use it at session start, after each finished piece of work, and at session end |

Save screenshots and test output to `.screenshots/` or `.tmp/`. Both are gitignored.

## Public repo rules (important)

Everything committed here is world-readable forever, git history included. Never commit:

- API keys, tokens, passwords, `.env` files, cookies, or service account JSON. If a feature needs a key, read it from an environment variable or a gitignored `config.local.js`, and commit a `config.example.js` with placeholders.
  - **Exception: ElevenLabs API keys (`ELEVENLABS_API_KEY`) may be committed.** The team decided they're low-value enough to be public. The shared keys live in `server/elevenlabs-key.js` (an array; `server.js` fails over between them), so every clone gets ASTRA's voice without setup, and keys in `.env` are tried first. This exception covers only ElevenLabs keys. Firebase credentials, service account JSON, and every other secret stay out of the repo.
- Personal data: email addresses, phone numbers, home addresses, real health data, or full names of people who haven't agreed to it. In docs, refer to collaborators by GitHub handle or first name.
- Machine-specific paths (`C:\Users\<name>\...`, `/home/<name>/...`) or anything else from someone's local environment.
- Content from private chats, Slack or Discord, or judges' feedback that wasn't meant to be public.

Personal notes and local settings go in **gitignored** files: `CLAUDE.local.md` (your private instructions to Claude) and `.claude/settings.local.json`. Before every commit, check `git diff --staged` for the items above. If a secret was ever committed, tell the owner: it must be revoked, because deleting it in a later commit doesn't remove it from history.

## Git sync protocol (many instances, many devices)

The `git-sync` skill (`.claude/skills/git-sync/SKILL.md`) runs this protocol without stopping to ask: at session start, after each finished piece of work, and before ending a session. The team has given standing approval for it to commit your own files and push to `main`.

Several Claude instances work on this repo at once, on different machines and sometimes **in the same folder on one machine**. The goal of every pull and push: **keep every feature from every instance working together. Never silently drop someone's work.**

### Ground rules
- **Never** use `git push --force`, `git reset --hard`, `git checkout -- <file>`, `git clean`, `git stash`, `git merge -X ours/theirs`, or `git checkout --ours/--theirs` on whole files. They destroy other instances' work. If you think you need one, stop and ask the user.
- **Stage only your own files**: `git add <paths>`, never a blind `git add -A` or `git add .`. Files you didn't create or edit may be another instance's work in progress in this same folder. If `git status` shows changes you don't recognize, leave them alone, and mention them to the user if they block you.
- Use merge, not rebase: `git pull --no-rebase`. It keeps everyone's commits intact and makes conflicts easier to reason about.
- Commit small and often, so other instances can integrate early.

### Before pulling
1. `git status` to see what's modified locally and whether it's yours.
2. `git fetch origin`, then look at what's incoming before you merge it:
   `git log --oneline HEAD..origin/main` and `git diff --stat HEAD...origin/main`.
3. Read any new entries in `docs/HISTORY.md` on the remote (`git show origin/main:docs/HISTORY.md | tail -40`) to learn what others changed and why.
4. Commit your own finished work first (your files only), then `git pull --no-rebase origin main`.

### Resolving conflicts and discrepancies
The aim is a **union** that keeps both sides working, not a pick between them.
1. For each conflicted file, read **both** versions and the surrounding code. Check HISTORY for the intent behind each side.
2. **Combine:**
   - Shared registries get the union of both sides: `TOOLS` and `ICONS` (`js/data.js`), `TOOL_ALIASES` and `RULES` (`js/vega.js`), `NAV_LINKS` (`js/common.js`), CSS tokens and components, routes in `server.js` and `server/`, `.env.example` keys, `<script>` tags (keep the load order), the README, and the CLAUDE.md tables.
   - If both sides edited the same function differently, merge the logic so both features still work. Don't keep just one.
   - For `docs/HISTORY.md`, keep every entry in chronological order.
3. **Find the silent discrepancies too.** A merge without conflict markers can still break things:
   - IDs or keys added twice.
   - A renamed function still called by its old name.
   - A page that uses a script it no longer loads.
   - Two different implementations of the same feature.
   - Docs that disagree with the code (for example, the CLAUDE.md file table versus the actual files).
4. If the two sides genuinely contradict each other (the same feature built two incompatible ways, or opposite decisions in HISTORY), keep the behavior HISTORY agreed on, or keep both behind a clear switch. Write a **"Discrepancy"** note in your HISTORY entry and tell the user. Don't decide alone on something the team should decide.
5. **Verify before committing the merge:**
   - Run `git grep -nE '^(<<<<<<<|=======|>>>>>>>)'`. It should return nothing.
   - Run `node --check` on every changed `.js` file.
   - Start `node server.js` and load every page. Check for console errors with the `webapp-testing` skill if you can. At least make sure the HUD, tools, and ASTRA pages render and a voice or typed command works.

### Before pushing
1. `git fetch origin` again. If `origin/main` moved since your last pull, repeat the pull and merge steps above, then verify again.
2. Check `git diff --staged` against the "Public repo rules": no keys (except the ElevenLabs key), no `.env`, no emails, no personal paths.
3. Make sure your HISTORY entry is in the same push as the work it describes.
4. `git push origin main`. If it's rejected (non-fast-forward), fetch, merge, verify, and push again. **Never force.**

## Session history protocol

[docs/HISTORY.md](docs/HISTORY.md) is how Claude instances on different machines hand off work to each other.

1. **At session start**, follow "Before pulling" above, then read the last 3 or so entries in HISTORY.md.
2. **At session end**, or after any significant change, append a new entry at the **bottom** using the template in that file. Keep it short: what changed, decisions and their reasons, open TODOs, gotchas, and any discrepancies you resolved or left open.
3. Append only. Don't rewrite other people's entries; add a correction entry instead.
4. Commit the HISTORY entry together with the work it describes, so a `pull` brings both.
5. If you `pull` and get a merge conflict in HISTORY.md, keep both sides in chronological order.
