# CLAUDE.md

Shared instructions for every Claude Code instance working on this repo. This file is committed, and **the repo is public**. Read "Public repo rules" before you write anything.

## What this is

**AstraSight**, our NASA Space Apps Challenge 2026 entry for **"Create Health Monitoring Software for Astronauts on Space Missions"**. It's a concept website for smart glasses with an in-lens health HUD (a side panel) and **VEGA**, an on-device voice assistant that reads vitals, explains them, and suggests actions.

- Challenge page: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- The hackathon runs **Nov 14–15, 2026**. Time is short: favor working demos over refactors.
- The full brief, research notes, and a gap analysis against the brief are in [docs/CHALLENGE.md](docs/CHALLENGE.md). **Read it before making product decisions.**
- What earlier sessions did, decided, and left open is in [docs/HISTORY.md](docs/HISTORY.md). **Read the latest entries first, and append your own entry at the end of your session** (see "Session history protocol").

### Product flow (team plan, Nov 14)

Several agents build these in parallel. Each piece has a contract doc; code against it, not against another agent's internals.

1. **Sign-in:** face recognition (open-source face-api.js) plus Firebase Auth. New crew enter only a name and do a face scan. Done: `login.html`, `js/auth.js` (`window.AstraAuth`), and `server/auth.js`. See [docs/AUTH.md](docs/AUTH.md).
2. **First visit:** after enrolling, crew land on `interface.html?welcome=1` with `onboarded: false` in their profile. Show a **tutorial** on using the site plus VEGA's **AI questionnaire**, which tailors baselines to that astronaut. When it's done, call `AstraAuth.saveProfile({ profile, onboarded: true })`.
3. **AI backend:** Ollama running **Qwen 2.5**, behind `/api/ai/*` (onboarding, chat, brief). See [docs/AI-BACKEND.md](docs/AI-BACKEND.md). Its persona (`server/persona.md`) is the VEGA persona from the team's Gemini prototype.
4. **Chat:** after tailoring, the VEGA chatbox is a **sidebar** available across the site (`/api/ai/chat`).
5. **Critical-stats screen:** a *separate* feature from the chat. It's the VEGA persona's screen for visualizing critical stats (`report.html`, `/api/ai/brief`).

## Stack and running

The frontend has no build step: plain HTML, CSS, and vanilla JS loaded with `<script>` tags. The backend is `server.js`, Node 18+ with **no npm dependencies**. Keep both that way unless the team decides otherwise, and record that decision in HISTORY.

```sh
cp .env.example .env      # add keys locally; .env is gitignored, never commit it
ollama pull qwen2.5:3b    # for VEGA's AI routes (see docs/AI-BACKEND.md)
node server.js            # Node 18+, http://localhost:8000: static site + /api/*
npm run dev               # same, plus starts Ollama first if it isn't running (dev.js)
# frontend only, no AI or TTS:  python -m http.server 8000
```

`server.js` serves the site and proxies VEGA's voice to ElevenLabs (`/api/tts`; it uses the shared key in `server/elevenlabs-key.js` unless `.env` sets `ELEVENLABS_API_KEY`). Other static servers (`npx serve`, `python -m http.server`, Live Server) still get the ElevenLabs voice as long as `node server.js` is also running on port 8000: VEGA falls back to `http://localhost:8000/api/tts`, and the server allows CORS from localhost origins only. If neither is reachable (or on `file://`), VEGA uses the browser's robotic voice and logs a console warning.

Free-form questions in the HUD's command box go to a local [Ollama](https://ollama.com) model through `server.js` (`/api/chat`; set `OLLAMA_URL` and `OLLAMA_MODEL` in `.env`, default `qwen2.5:3b`, the same model as `/api/ai/*`). The system prompt is fixed in `server.js` and keeps VEGA on AstraSight features and mission topics; the page sends only the conversation and the current simulated readings. Built-in commands are still handled by the rule-based parser. Without Ollama, questions get the built-in answer or "didn't catch that".

Voice input (Web Speech API) needs a secure origin (localhost counts) and Chrome or Edge. Typed commands work everywhere. Without the server or keys, VEGA falls back to the browser's built-in voice.

| File | Role |
|------|------|
| `index.html` | Landing page: product, the 8 tools, intro to VEGA |
| `interface.html` + `js/hud.js` | Interactive lens HUD: simulated vitals, dockable side panel, voice and typed commands, alerts |
| `tools.html` + `js/tools.js` | One demo stage per tool: procedural signal canvas, swapped for `media/<id>.mp4` if that file exists |
| `vega.html` + `js/vega.js` | VEGA's rule-based intent parser (`VEGA.parse(text) → {intent, slots, confidence}`) and speech in/out |
| `report.html` | Report screen (the team's "EVA-MED HUD" prototype): habitat/IVA and EVA modes, suit telemetry with manual override, DCS risk heuristic, radiation shelter window, crew and habitat sensor modules, body-map triage with a rule-based review plus a VEGA AI note (`/api/ai/chat` with telemetry as `context`), VEGA as a 16-bit pixel companion, crew profile and ship-wide PA log. Uses the Tailwind CDN, unlike the rest of the site |
| `js/crew.js` | `Crew` (rank and name for alerts; uses the signed-in name if `auth.js` is loaded), `ShipPA.announce()` (chime plus crew-wide spoken alert via `VEGA.speak`), `ReportBus` (report-screen heartbeat across tabs) |
| `js/onboarding.js` | First-visit questionnaire overlay on `interface.html?welcome=1` (or `?onboard=1` to rerun): VEGA asks the `/api/ai/onboard/*` questions one at a time; every answer can be typed or spoken (mic button, Web Speech API, matches spoken words to choice options); ends with a short tour and `AstraAuth.saveProfile({ profile, onboarded: true })` |
| `js/glasses3d.js` | Home-page 3D glasses (three.js 0.160.0 UMD from jsDelivr, procedural, no model files) with callout arrows to the left button, right button and scroll knob; drag to rotate, falls back to text cards without WebGL |
| `js/companion.js` + `css/companion.css` | Home-page VEGA pop-up: greets by name and pops up with simulated hazards, but only while `report.html` isn't open in another tab |
| `js/data.js` | **Single source of truth** for the tools: `TOOLS[]` (id, unit, base, jitter, warn thresholds, sensor, steps, voice cmd, wave type) and `ICONS` |
| `js/common.js` | Shared nav and footer (`NAV_LINKS`), starfield, `.reveal` scroll-in, `drawSpark()` |
| `server.js` + `server/` | Node dev server (no deps): static files, `/api/tts` (ElevenLabs), `/api/ai/*` (VEGA on Qwen 2.5 via local Ollama). API contract in [docs/AI-BACKEND.md](docs/AI-BACKEND.md); persona in `server/persona.md` |
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
- All health data is **simulated**. Keep the "Concept prototype · Simulated data · Not a medical device" disclaimer. VEGA *flags and suggests* but never diagnoses, and serious findings escalate to the flight surgeon. This is part of the pitch and part of the brief.
- Copy is plain and specific: active voice, sentence case, no hype.
- Before claiming a UI change works, run it and check it with the `webapp-testing` skill (Playwright screenshots).

## Skills in this repo (`.claude/skills/`)

These are committed, so every collaborator's Claude Code loads them automatically.

| Skill | Use it for |
|-------|------------|
| `space-health-research` | Any health or medical content: which indicators, normal ranges, NASA hazards and risks, thresholds for flight-surgeon escalation, countermeasures. Cite sources. |
| `frontend-design` | New pages, or a visual redesign of an existing one (imported from `anthropics/skills`, Apache-2.0) |
| `webapp-testing` | Driving the site in headless Chromium to verify behavior and take screenshots (imported from `anthropics/skills`, Apache-2.0). Needs `pip install playwright && playwright install chromium`. |

Save screenshots and test output to `.screenshots/` or `.tmp/`. Both are gitignored.

## Public repo rules (important)

Everything committed here is world-readable forever, git history included. Never commit:

- API keys, tokens, passwords, `.env` files, cookies, or service account JSON. If a feature needs a key, read it from an environment variable or a gitignored `config.local.js`, and commit a `config.example.js` with placeholders.
  - **Exception: the ElevenLabs API key (`ELEVENLABS_API_KEY`) may be committed.** The team decided it's low-value enough to be public. The shared key lives in `server/elevenlabs-key.js`, so every clone gets VEGA's voice without setup, and `ELEVENLABS_API_KEY` in `.env` overrides it. This exception covers only that key. Firebase credentials, service account JSON, and every other secret stay out of the repo.
- Personal data: email addresses, phone numbers, home addresses, real health data, or full names of people who haven't agreed to it. In docs, refer to collaborators by GitHub handle or first name.
- Machine-specific paths (`C:\Users\<name>\...`, `/home/<name>/...`) or anything else from someone's local environment.
- Content from private chats, Slack or Discord, or judges' feedback that wasn't meant to be public.

Personal notes and local settings go in **gitignored** files: `CLAUDE.local.md` (your private instructions to Claude) and `.claude/settings.local.json`. Before every commit, check `git diff --staged` for the items above. If a secret was ever committed, tell the owner: it must be revoked, because deleting it in a later commit doesn't remove it from history.

## Git sync protocol (many instances, many devices)

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
   - Start `node server.js` and load every page. Check for console errors with the `webapp-testing` skill if you can. At least make sure the HUD, tools, and VEGA pages render and a voice or typed command works.

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
