---
name: space-health-research
description: Domain knowledge for the AstraSight NASA Space Apps 2026 entry ("Create Health Monitoring Software for Astronauts on Space Missions"). Use whenever writing or changing health indicators, normal ranges, warning thresholds, treatment or guidance copy, flight-surgeon escalation rules, NASA hazard (RIDGE) or HRP risk content, or anything a judge might fact-check.
---

# Space health research

1. **Read [docs/CHALLENGE.md](../../../docs/CHALLENGE.md) first.** It has the official brief, the resource list, research notes marked ✅ (verified) or ⚠️ (unverified), and the gap analysis.
2. **Map every indicator to the brief.** For each health indicator, be able to answer the brief's questions: Can it be measured in space, and how? Why is the exam needed? Which RIDGE hazard affects it? What reading needs **crew** attention, and what needs the **flight surgeon**? What preventive actions are there?
3. **Prefer primary sources:** nasa.gov/hrp (hazards, risks, HRP research), NASA-STD-3001 technical briefs, ntrs.nasa.gov, and asc-csa.gc.ca. Use secondary sites only to find primary ones.
4. **Mark confidence.** When you add a fact to `docs/CHALLENGE.md` or to site copy, mark it ✅ with a source link, or ⚠️ if unverified. Never present a ⚠️ number as fact on the site.
5. **Medical framing:** AstraSight flags, explains, and suggests; it does not diagnose. Guidance is general wellness or protocol-style ("rest, hydrate, re-measure in 10 min; if still above X, contact the flight surgeon"). Keep the "simulated data, not a medical device" disclaimer.
6. **Where data lives:** indicator definitions go in `TOOLS` in `js/data.js` (`base`, `jitter`, `min`/`max`, `warnLo`/`warnHi`, `range`, `steps`). Keep `range` (display text) consistent with `warnLo`/`warnHi` (logic).
7. Note any new research or decisions in `docs/HISTORY.md` at the end of the session.
