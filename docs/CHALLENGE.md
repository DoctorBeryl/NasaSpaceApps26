# Challenge brief and research

## The challenge (official, Space Apps 2026)

**Create Health Monitoring Software for Astronauts on Space Missions**
https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ · Hackathon: Nov 14–15, 2026

Summary of the official text:

- **Summary.** Spaceflight exposes astronauts to radiation, isolation and confinement, altered gravity, and a hostile closed environment. These can cause immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts are largely responsible for spotting these changes in themselves. *Build health monitoring software that gathers health indicators and lets astronauts evaluate and act on the status of their health.*
- **Background.** Artemis has flown a crewed lunar flyby, and Mars is next. Longer missions mean more exposure. The brief lists these health indicators as examples: **blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, and mood.**
- **Objective.** Create a **visual tool that helps astronauts assess their own health** and **gives guidance on treatments and health improvements**. Input can be anything: keyboard text, mouse clicks, camera images. Data can be any health indicator, for example blood sugar in mg/dL or ultrasound images. The brief suggests working through these questions:
  - Which measurements can be performed in space?
  - Why is an exam needed?
  - How do spaceflight hazards affect each indicator?
  - **When does a result warrant attention from the crew, or from flight surgeons on the ground?**
  - What actions can prevent a critical condition?
- **UI matters.** The brief encourages animation and interactivity. Its example is *a human figure where each body part is clickable and shows its function and health status.*
- **Optional considerations:**
  - Support different environments: spacecraft, station, rover, or a Moon or Mars base.
  - **Prompt routine measurements** and actions as part of the mission schedule.
  - **Gamification** to encourage health tasks.
  - **Dynamic charts** of indicators over time.
  - **Color coding** so status reads at a glance.
  - **Don't assume expertise.** Include simple instructions and explanations of measurements, indicators, and risks.

### Resources listed by the challenge

- NASA, [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- NASA, [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- NASA, Ongoing HRP Research in Space (HRP articles)
- CSA, [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- CSA, [Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)
- Space Apps note: NASA does not endorse non-U.S. Government entities. Follow each site's data-use terms.

## Research notes

✅ means checked against the linked source. ⚠️ means commonly cited but not yet checked against a primary NASA or CSA page; verify before showing it to judges.

### The five hazards ("RIDGE"), from NASA HRP ✅

| Hazard | What it means | What AstraSight could monitor |
|---|---|---|
| **R**adiation | Invisible; among the most hazardous aspects of spaceflight | Personal dose rate and cumulative dose against the career limit (the `rad` tool) |
| **I**solation and confinement | Behavioral changes in small crews over long periods | Mood, stress/HRV, sleep, cognitive load (`hrv`, `cog`; **mood and sleep are missing**) |
| **D**istance from Earth | Mars averages ~140M miles away; a mission lasts ~3 years. Supplies and medical help are hard to get, so the crew must be self-sufficient. | Fully on-device VEGA; self-guided treatment steps; delayed-comms escalation |
| **G**ravity fields | Muscles, bones, inner ear, and organs adapt; Mars is 3/8 g; readjustment on return | Cardiovascular (BP, HR), SANS/ocular (`neuro`), exercise compliance; **bone and muscle are missing** |
| Hostile/closed **E**nvironment | Temperature, pressure, light, noise, and microbes must be controlled; immune monitoring | Cabin CO₂ and O₂ correlation (`spo2`, `resp`), temperature/fever (`thermal`) |

### NASA HRP named risks most relevant to self-monitoring ✅ (from the Risks page)

Cardiovascular adaptations · SANS (eye and brain structure changes) · hypoxia · spaceflight-induced bone changes · reduced cardiorespiratory and musculoskeletal fitness · altered immune response (stress can reactivate latent viruses) · altered sensorimotor and vestibular function · inadequate food and nutrition · inadequate sleep and irregular schedules · behavioral changes and psychiatric disorders · decompression sickness · EVA injury (suit O₂ and CO₂) · radiation-induced cancer.

### Numbers

- ✅ NASA career radiation limit: **600 mSv effective dose**, the same for all ages and sexes (NASA-STD-3001; [radiation technical brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf)). NASA-affiliated projections put a Mars mission at roughly 1,000–1,200 mSv, about twice the limit. This makes a strong case for a dose budget bar.
- ✅ Neutrons make up about **30%** of total radiation dose on the ISS (CSA). Canadian instruments: CANS (Canadian Active Neutron Spectrometer), plus earlier bubble detectors, MOSFET, EVARM, and Radi-N/N2.
- ✅ CSA: weightlessness effects resemble **accelerated aging** and a sedentary lifestyle (bone, heart, blood vessels, brain), and six months in space yields data that would take years on Earth.
- ⚠️ ISS dose rate is roughly 0.3–0.8 mSv/day; `js/data.js` uses 0.62 baseline and 1.5 warn.
- ⚠️ Bone mineral density loss is about 1–1.5% per month in weight-bearing bones without countermeasures.
- ⚠️ SANS affects a large share (often quoted as ~70%) of long-duration crew.
- ⚠️ CSA wearables worth citing: **Bio-Monitor** (HR, BP, breathing, temperature, activity), **Vascular Aging**, **AstroFit**. Check the CSA pages before quoting.

## Gap analysis: AstraSight vs. the brief

Current strengths: color-coded live vitals, sparklines, alerts, voice and typed input, on-device AI (answers "distance from Earth"), personal baselines, and flight-surgeon escalation framing.

Missing, roughly in order of impact for judging:

1. **Indicators the brief names but we don't have:** blood pressure, blood sugar (mg/dL), **daily sleep hours**, **mood**. Mood and sleep aren't sensor readings, so they need **manual check-in input** (sliders or a mood picker), which the brief explicitly invites.
2. **Treatment and guidance content:** each indicator needs "what this means, why it changes in space (which hazard), what to do now, and when to call the flight surgeon". Add `explain`, `hazard`, `actions[]`, and `escalate` fields to each entry in `TOOLS`.
3. **Clickable body figure:** the brief's own example. An SVG human figure where each region (eyes, heart, lungs, bones, brain) opens its indicators and status.
4. **Trends over time:** the current sparklines cover 48 s. Add a mission-day view (days or weeks) with dynamic charts.
5. **Mission routine prompts:** scheduled check-ins ("Morning: BP + mood", "Post-exercise: HR") with **gamification** such as streaks or a crew readiness score.
6. **Environment selector:** ISS / Lunar base / Mars transit / Mars base. Change thresholds, dose rate, gravity, and comm delay to match.
7. **Explicit RIDGE mapping** on the site, so judges see we used the NASA resources.
8. Cite the NASA and CSA sources on the site (an "About the science" section).

## Extension idea: smart handrails

Full note: [docs/research/smart-handrails.md](research/smart-handrails.md). Sensors in the spacecraft's support bars collect short, passive health samples (grip force, PPG, two-hand ECG, skin conductance) at every touch, and stream them to the wearer's AstraSight HUD.

- ✅ NASA's closest equivalent to "phenotyping" is **Spaceflight Standard Measures** (a core dataset and baseline from all crew; 9 measures, [NASA](https://www.nasa.gov/humans-in-space/spaceflight-standard-measures-characterizing-how-humans-adapt-in-space)) plus **CIPHER** (14 studies, up to 30 astronauts, whole-body, [NASA](https://www.nasa.gov/reference/about-cipher)). Almost all of it is episodic; actigraphy is the only continuous measure.
- ✅ Handgrip and pinch force declined during long ISS increments and didn't recover in flight (2 crew; Puglia et al. 2018).
- ✅ Steering-wheel two-hand ECG (Lead I) gave usable signal only 42–48% of the time while driving (Warnecke et al., *Sensors* 2022), so rail ECG is opportunistic.
- ✅ Microbes persist on ISS handrails; DLR's *Touching Surfaces* experiment tested antimicrobial copper alloys.
