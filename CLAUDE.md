# CLAUDE.md

Shared instructions for every Claude Code instance working on this repo. This file is committed, and **the repo is public**. Read "Public repo rules" before you write anything.

## What this is

**AstraSight**, our NASA Space Apps Challenge 2026 entry for **"Create Health Monitoring Software for Astronauts on Space Missions"**. It's a concept website for smart glasses with an in-lens health HUD (a side panel) and **VEGA**, an on-device voice assistant that reads vitals, explains them, and suggests actions.

- Challenge page: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- The hackathon runs **Nov 14–15, 2026**. Time is short: favor working demos over refactors.
- The full brief, research notes, and a gap analysis against the brief are in [docs/CHALLENGE.md](docs/CHALLENGE.md). **Read it before making product decisions.**
- What earlier sessions did, decided, and left open is in [docs/HISTORY.md](docs/HISTORY.md). **Read the latest entries first, and append your own entry at the end of your session** (see "Session history protocol").

## Stack and running

A static site with no build step and no dependencies: plain HTML, CSS, and vanilla JS loaded with `<script>` tags. Keep it that way unless the team decides otherwise, and record that decision in HISTORY.

```sh
node server.js      # Node 18+, then open http://localhost:8000
```

`server.js` serves the site and proxies VEGA's voice to ElevenLabs (`/api/tts`, key from the gitignored `.env`; copy `.env.example`). Other static servers (`npx serve`, `python -m http.server`, Live Server) still get the ElevenLabs voice as long as `node server.js` is also running on port 8000: VEGA falls back to `http://localhost:8000/api/tts`, and the server allows CORS from localhost origins only. If neither is reachable (or on `file://`), VEGA uses the browser's robotic voice and logs a console warning.

Voice input (Web Speech API) needs a secure origin (localhost counts) and Chrome or Edge. Typed commands work everywhere.

| File | Role |
|------|------|
| `index.html` | Landing page: product, the 8 tools, intro to VEGA |
| `interface.html` + `js/hud.js` | Interactive lens HUD: simulated vitals, dockable side panel, voice and typed commands, alerts |
| `tools.html` + `js/tools.js` | One demo stage per tool: procedural signal canvas, swapped for `media/<id>.mp4` if that file exists |
| `vega.html` + `js/vega.js` | VEGA's rule-based intent parser (`VEGA.parse(text) → {intent, slots, confidence}`) and speech in/out |
| `report.html` | Report screen: EVA suit telemetry, radiation shelter timer, DCS risk, post-EVA triage, VEGA as a 16-bit pixel companion, crew profile and ship-wide PA log. Imported from the team's Gemini prototype; it uses the Tailwind CDN, unlike the rest of the site |
| `js/crew.js` | `Crew` (rank and name for alerts; uses the signed-in name if `auth.js` is loaded), `ShipPA.announce()` (chime plus crew-wide spoken alert via `VEGA.speak`), `ReportBus` (report-screen heartbeat across tabs) |
| `js/companion.js` + `css/companion.css` | Home-page VEGA pop-up: greets by name and pops up with simulated hazards, but only while `report.html` isn't open in another tab |
| `js/data.js` | **Single source of truth** for the tools: `TOOLS[]` (id, unit, base, jitter, warn thresholds, sensor, steps, voice cmd, wave type) and `ICONS` |
| `js/common.js` | Shared nav and footer (`NAV_LINKS`), starfield, `.reveal` scroll-in, `drawSpark()` |
| `css/styles.css` | Design tokens in `:root` (dark space theme: cyan, violet, magenta, plus ok/warn/crit) and all components |

Script load order matters: `data.js` → `common.js` → `vega.js` → page script.

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
- Personal data: email addresses, phone numbers, home addresses, real health data, or full names of people who haven't agreed to it. In docs, refer to collaborators by GitHub handle or first name.
- Machine-specific paths (`C:\Users\<name>\...`, `/home/<name>/...`) or anything else from someone's local environment.
- Content from private chats, Slack or Discord, or judges' feedback that wasn't meant to be public.

Personal notes and local settings go in **gitignored** files: `CLAUDE.local.md` (your private instructions to Claude) and `.claude/settings.local.json`. Before every commit, check `git diff --staged` for the items above. If a secret was ever committed, tell the owner: it must be revoked, because deleting it in a later commit doesn't remove it from history.

## Session history protocol

[docs/HISTORY.md](docs/HISTORY.md) is how Claude instances on different machines hand off work to each other.

1. **At session start**, `git pull`, then read the last 3 or so entries in HISTORY.md.
2. **At session end**, or after any significant change, append a new entry at the **bottom** using the template in that file. Keep it short: what changed, decisions and their reasons, open TODOs, and gotchas.
3. Append only. Don't rewrite other people's entries; add a correction entry instead.
4. Commit the HISTORY entry together with the work it describes, so a `pull` brings both.
5. If you `pull` and get a merge conflict in HISTORY.md, keep both sides in chronological order.
