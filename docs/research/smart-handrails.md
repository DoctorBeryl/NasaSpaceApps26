# Smart handrails: passive phenotyping at every touch

Research note for an AstraSight extension idea: put sensors in the spacecraft's support bars (handrails), so every time a crew member grabs one, the rail takes a few seconds of health measurements and sends them to that person's AstraSight HUD.

✅ = checked against the linked source. ⚠️ = plausible but not verified, or our own design choice. Don't show ⚠️ items to judges as fact.

## 1. What NASA does today ("phenotyping")

NASA doesn't brand its astronaut work as "phenotyping" on its public pages (we couldn't confirm the phrase "deep phenotyping" on nasa.gov ⚠️). The work that matches the idea, building a detailed, repeated, whole-body profile of each astronaut, runs under these names:

**Spaceflight Standard Measures** ✅ ([NASA](https://www.nasa.gov/humans-in-space/spaceflight-standard-measures-characterizing-how-humans-adapt-in-space)). A consistent core dataset collected from as many crew as possible, to set a baseline for how body and mind adapt to spaceflight. Nine core measures:

| Measure | How |
|---|---|
| Actigraphy | Wrist monitor: activity and light exposure, for sleep-wake cycles |
| Biochemical markers | Blood and urine |
| Carotid intima-media thickness | Neck ultrasound |
| Cellular profile | Blood and saliva, for immune changes |
| Cognition | 10 computer-based tests (memory, risk decisions) |
| Microbiome | Body, saliva, and fecal samples |
| Personality | Pre-flight questionnaire (five major traits) |
| Sleep quality / team | Questionnaires on sleep, mood, team cohesion |
| Sensorimotor | Movement, balance, HR, and BP, **before and after** the mission |

**CIPHER** (Complement of Integrated Protocols for Human Exploration Research) ✅ ([NASA](https://www.nasa.gov/reference/about-cipher)). 14 studies, up to 30 astronauts in three mission lengths (under ~3.5 months, ~3.5–8 months, over ~8 months). It takes "a full-body approach": bones and joints, brain and behavior, heart and circulation, exercise performance, balance and sensorimotor function, eyesight, and biomarkers. Data are collected before, during, and after flight, then "fully integrated into one set" with the Standard Measures baseline.

**SOMA, the Space Omics and Medical Atlas** ✅ (Overbey et al., *Nature* 632, 2024, [doi:10.1038/s41586-024-07639-y](https://doi.org/10.1038/s41586-024-07639-y)). Multi-omic and clinical data (genome, epigenome, transcriptome, proteome, metabolome, microbiome) from the NASA Twins Study, JAXA CFE, Inspiration4, Axiom, and Polaris. The authors frame it as "precision aerospace medicine".

**The gap the handrail idea fills.** Almost all of the above is *episodic*: a scheduled session, a sample, a questionnaire, or a test done before and after flight (sensorimotor in particular). Actigraphy is the only continuous measure, and it covers activity and light, not physiology. A handrail is touched dozens of times a day ⚠️ (a reasonable assumption for moving around in microgravity, not a measured number), so it can collect many short, *passive*, in-flight samples with no scheduled crew time.

## 2. Evidence for what a rail can measure

### Grip strength and grip-force control (the strongest angle)
- ✅ Handgrip and pinch performance declined during long ISS increments and didn't recover in flight, unlike the small, quickly reversed dip on 10-day flights. Small sample: 2 astronauts, increments 7–8 (Puglia et al., *Int. J. Aerospace Eng.* 2018, [DOAJ](https://doaj.org/article/29fd7f5c16e7457da745337c299f2f1e)).
- ✅ 11 ESA astronauts applied too much grip force in orbit, because the brain still expects gravity, and grip-force errors lasted for months after landing (Lefèvre et al., *J. Neuroscience*, 2026, reported by [Space.com](https://www.space.com/space-exploration/human-spaceflight/astronauts-lose-their-grip-going-to-space-scientists-say)). ⚠️ Read the paper itself before quoting numbers.
- Why it matters: it maps to two HRP risks on our list, *reduced musculoskeletal fitness* and *altered sensorimotor function* (gravity hazard). A rail with a load cell gives a daily grip trend with no test session.

### Heart signals through the hands
- ✅ Two-hand ECG equals **Lead I** (left hand vs. right hand). Steering-wheel ECG studies show it works but is fragile: in real driving, usable signal covered only **42–48%** of the time (Warnecke et al., *Sensors* 2022, [PMC9185422](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9185422/)). A rail grip is shorter and moves more than a steering wheel, so expect *opportunistic* readings, not continuous ones.
- Limitation: Lead I needs **both hands** on electrodes. With one hand on a rail, use **PPG** (optical, like a smartwatch) for heart rate and SpO₂ instead ⚠️ (standard wearable technique; accuracy under motion not checked for this use).

### Other candidates (all ⚠️, need sources before the pitch)
- **Electrodermal activity** (skin conductance): a stress and arousal signal, for the isolation hazard. Pairs with our `hrv` tool.
- **Skin temperature**: peripheral only, so a trend input, not a core-temperature replacement.
- **Tremor / micro-motion** (accelerometer in the rail): fatigue and sensorimotor signal.
- **Hand-to-hand bioimpedance**: hydration and fluid shift. Weak evidence for hand-only measurement; treat as speculative.

### The rail as an environment sensor
- ✅ Microbes persist on frequently touched ISS surfaces, including handrails. DLR's *Touching Surfaces* experiment (Matthias Maurer, Cosmic Kiss mission) tested laser-patterned copper, brass, and steel "touch arrays" as antimicrobial surfaces ([DLR](https://www.dlr.de/en/latest/news/2022/01/20220118_fingerprint-research-to-combat-harmful-bacteria)).
- Idea: an antimicrobial copper-alloy grip plus a touch-count heatmap tells the crew which rails to clean first. This covers the **hostile/closed environment** hazard.

## 3. The AstraSight concept: "rail sessions"

1. **Touch.** A crew member grabs a rail. The glasses already know who is wearing them, so the rail pairs to the nearest AstraSight headset (short-range radio, ⚠️ design choice). No fingerprint or vein scan, which keeps biometric data to a minimum.
2. **Micro-session (2–10 s).** The rail records grip force, PPG heart rate, skin conductance, and temperature. If the person holds the rail with both hands long enough, it adds a Lead I ECG strip.
3. **Quality gate.** Readings with motion artifacts are dropped. Only clean samples go into the personal trend.
4. **Baseline and flags.** Each sample is compared to that person's own pre-flight baseline (the same logic as Standard Measures). One sample never raises an alert, only a trend does.
5. **HUD and VEGA.** A small "Rail" chip in the side panel. VEGA explains the trend and suggests an action.

Example VEGA lines (wellness framing, no diagnosis):
- "Your grip strength is 9% below your pre-flight baseline over the last 7 days. Your next resistance-exercise block is at 14:00. Want me to flag it as a priority?"
- "You've gripped rails much harder than you need to all morning. That's common in the first weeks of microgravity. Try a lighter touch."
- "Rail 3B in Node 2 is the most-touched surface today. It's next on the cleaning list."

Escalation rule (⚠️ our proposal, not a NASA threshold): an irregular rhythm on two separate rail ECG strips, or a grip drop of more than 15% sustained for 14 days, goes to the flight surgeon with the raw strips attached.

### RIDGE mapping

| Hazard | What the rail adds |
|---|---|
| Isolation | Skin conductance plus HRV: a passive stress trend |
| Gravity | Grip strength and force control (muscle, sensorimotor), heart rate |
| Hostile environment | Antimicrobial surface and touch heatmap for cleaning |
| Distance | Everything runs on board; no ground link needed for daily trends |
| Radiation | No direct contribution (keep the dosimeter) |

## 4. Honest limits (for the Q&A)
- Contact is short and moving, so many grips give no usable data (the steering-wheel data above shows the same).
- Crew in microgravity often anchor with their **feet** (foot restraints) at workstations, so hand-rail use varies by task ⚠️.
- EVA and gloved hands: no skin contact, so no reading.
- Power, wiring, cleaning chemicals, and outgassing all need spacecraft certification. This is a concept.
- Privacy: rail data is crew medical data. Store it per person and share it only with the crew member and the flight surgeon.

## 5. How it fits the current site (proposal)
- Add a `grip` entry to `TOOLS` in `js/data.js` (`sensor: "Smart handrail (load cell)"`, unit kgf). Base, jitter, and warn values must be **relative to a personal baseline**, so mark them as simulated.
- Add `TOOL_ALIASES` for "grip", "hand strength", and "handrail" in `js/vega.js`.
- In `interface.html`, show a simulated "rail session" event every ~30 s: a short pulse of grip, HR, and EDA values, with a "Rail 3B" source label.
- On `tools.html`, a demo stage with a force curve and a PPG trace.
- On `index.html`, a section called "The station measures you too", with a sentence on how the rails complement NASA's Standard Measures.
