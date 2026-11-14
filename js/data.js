/* ==========================================================
   AstraSight — diagnostic tool registry
   Shared by the HUD interface, tools page, home page and VEGA.
   ========================================================== */
const ICONS = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/><path d="M9 14h6M12 11v6"/></svg>',
  lungs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9M12 12l-3-2M12 12l3-2"/><path d="M8.5 8C5 8 3 13 3 17c0 2 1 3 3 3 2.5 0 3.5-2 3.5-5V9.5"/><path d="M15.5 8C19 8 21 13 21 17c0 2-1 3-3 3-2.5 0-3.5-2-3.5-5V9.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3A3 3 0 0 0 6.5 6a3 3 0 0 0-2.5 4.5A3.5 3.5 0 0 0 6 17a3 3 0 0 0 3.5 4 2.5 2.5 0 0 0 2.5-2.5V5.5A2.5 2.5 0 0 0 9.5 3z"/><path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2.5 4.5A3.5 3.5 0 0 1 18 17a3 3 0 0 1-3.5 4 2.5 2.5 0 0 1-2.5-2.5"/></svg>',
  temp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 9v8"/></svg>',
  rad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 10V3a9 9 0 0 1 7.8 4.5L13.7 11"/><path d="M13.7 13l6.1 3.5A9 9 0 0 1 12 21v-7"/><path d="M10.3 13l-6.1 3.5A9 9 0 0 1 4.2 7.5L10.3 11"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l2-6 4 12 3-9 2 3h6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
};

const TOOLS = [
  {
    id: "cardio", name: "Cardiac Rhythm", short: "Heart rate", icon: "heart",
    unit: "bpm", base: 72, jitter: 3, min: 40, max: 160, warnLo: 50, warnHi: 110, decimals: 0,
    sensor: "Temple PPG array", sample: "250 Hz", latency: "< 2 s",
    range: "60 – 100 bpm",
    blurb: "Photoplethysmography sensors in the temple arms read blood-volume pulses from the superficial temporal artery for continuous heart rate and rhythm-irregularity flags.",
    steps: [
      ["Optical capture", "Green and IR LEDs illuminate the temple; photodiodes measure reflected light 250×/sec."],
      ["Motion rejection", "IMU data cancels head-movement artifacts — critical during EVA or exercise."],
      ["Beat detection", "Peaks are extracted and R-R intervals feed rhythm analysis."],
      ["VEGA interpretation", "Trends are compared to the crew member's personal baseline, not population norms."],
    ],
    cmd: "VEGA, show my heart rate",
    wave: "ecg",
  },
  {
    id: "spo2", name: "Blood Oxygen", short: "SpO₂", icon: "drop",
    unit: "%", base: 97.6, jitter: 0.4, min: 70, max: 100, warnLo: 94, warnHi: 101, decimals: 1,
    sensor: "Dual-wavelength oximeter", sample: "50 Hz", latency: "< 4 s",
    range: "95 – 100 %",
    blurb: "Red/infrared absorption ratios estimate arterial oxygen saturation — an early warning for cabin atmosphere faults or suit pressure loss.",
    steps: [
      ["Dual wavelength", "660 nm red and 940 nm IR light pass through tissue at the nose bridge."],
      ["Ratio of ratios", "Pulsatile absorption at each wavelength is compared to estimate SpO₂."],
      ["Cabin correlation", "Readings are cross-checked against habitat O₂ partial pressure telemetry."],
      ["Hypoxia alert", "Sustained drops below 94% trigger a priority HUD alert and voice warning."],
    ],
    cmd: "VEGA, what's my oxygen level?",
    wave: "pleth",
  },
  {
    id: "resp", name: "Respiration", short: "Breathing", icon: "lungs",
    unit: "rpm", base: 15, jitter: 1, min: 4, max: 40, warnLo: 9, warnHi: 24, decimals: 0,
    sensor: "Nose-pad pressure + mic", sample: "100 Hz", latency: "~ 10 s",
    range: "12 – 20 breaths/min",
    blurb: "Micro-pressure sensors in the nose pads and the bone-conduction mic detect airflow and breath sounds to derive respiratory rate and pattern.",
    steps: [
      ["Airflow sensing", "Nose-pad pressure transducers detect the subtle cycle of inhale and exhale."],
      ["Acoustic fusion", "Breath sounds from the bone-conduction mic confirm each cycle."],
      ["Pattern analysis", "Rate, depth and regularity are computed over a rolling window."],
      ["CO₂ context", "Elevated rates are correlated with cabin CO₂ scrubber telemetry."],
    ],
    cmd: "VEGA, check my breathing",
    wave: "sine",
  },
  {
    id: "neuro", name: "Ocular Neuro Scan", short: "Pupillometry", icon: "eye",
    unit: "mm", base: 4.2, jitter: 0.15, min: 1, max: 9, warnLo: 2.5, warnHi: 7, decimals: 1,
    sensor: "Inward IR eye cameras", sample: "120 fps", latency: "~ 6 s",
    range: "2 – 8 mm (light-dependent)",
    blurb: "Inward-facing IR cameras track pupil size and light reflex — supporting screening for spaceflight-associated neuro-ocular syndrome (SANS).",
    steps: [
      ["Light stimulus", "A brief, calibrated flash is shown on the inner display."],
      ["Reflex capture", "120 fps IR cameras record constriction speed and latency in both eyes."],
      ["Symmetry check", "Left/right asymmetry and sluggish response are flagged."],
      ["Longitudinal trend", "Results are logged across the mission to spot slow neuro-ocular changes."],
    ],
    cmd: "VEGA, run a neuro scan",
    wave: "pupil",
  },
  {
    id: "cog", name: "Cognitive Load", short: "Fatigue", icon: "brain",
    unit: "/100", base: 34, jitter: 2, min: 0, max: 100, warnLo: -1, warnHi: 70, decimals: 0,
    sensor: "Blink + saccade tracking", sample: "120 fps", latency: "~ 30 s",
    range: "< 60 nominal",
    blurb: "Blink rate, blink duration and saccadic velocity combine into a fatigue and workload index — helping schedule critical tasks when crew are sharpest.",
    steps: [
      ["Eye metrics", "Blink frequency, closure duration (PERCLOS) and saccade speed are tracked."],
      ["Context", "Sleep logs and time-on-task are pulled from the mission schedule."],
      ["Index", "A 0–100 load score is computed; higher means more fatigue."],
      ["Recommendation", "VEGA suggests breaks or task reshuffling when load climbs."],
    ],
    cmd: "VEGA, how fatigued am I?",
    wave: "noise",
  },
  {
    id: "thermal", name: "Core Thermal", short: "Temperature", icon: "temp",
    unit: "°C", base: 36.8, jitter: 0.08, min: 33, max: 42, warnLo: 35.5, warnHi: 37.9, decimals: 1,
    sensor: "Temple thermopile", sample: "1 Hz", latency: "~ 20 s",
    range: "36.1 – 37.4 °C",
    blurb: "A contact thermopile at the temple estimates core temperature — tracking fever, heat stress during exercise, and the gradual 'space fever' rise seen in long missions.",
    steps: [
      ["Contact reading", "A thermopile measures skin temperature over the temporal artery."],
      ["Compensation", "Ambient cabin temperature and airflow are factored out."],
      ["Core estimate", "A heat-flux model estimates core body temperature."],
      ["Trend watch", "Rising baselines over days are flagged for the flight surgeon."],
    ],
    cmd: "VEGA, what's my temperature?",
    wave: "slow",
  },
  {
    id: "rad", name: "Radiation Dose", short: "Dosimeter", icon: "rad",
    unit: "mSv/d", base: 0.62, jitter: 0.03, min: 0, max: 20, warnLo: -1, warnHi: 1.5, decimals: 2,
    sensor: "Silicon PIN dosimeter", sample: "Continuous", latency: "Real-time",
    range: "0.3 – 0.8 mSv/day (LEO)",
    blurb: "A miniaturised silicon dosimeter in the frame logs personal radiation exposure, and warns during solar particle events to move to a shielded area.",
    steps: [
      ["Particle detection", "Charged particles deposit energy in a silicon PIN diode."],
      ["Dose accumulation", "Hits are converted to absorbed dose and integrated over time."],
      ["Mission budget", "Cumulative dose is tracked against career exposure limits."],
      ["Storm warning", "Spikes trigger a shelter-in-place alert with route guidance."],
    ],
    cmd: "VEGA, show radiation exposure",
    wave: "spikes",
  },
  {
    id: "hrv", name: "Stress / HRV", short: "Stress", icon: "wave",
    unit: "ms", base: 58, jitter: 3, min: 5, max: 200, warnLo: 25, warnHi: 999, decimals: 0,
    sensor: "Derived from PPG", sample: "5-min window", latency: "~ 60 s",
    range: "> 40 ms healthy",
    blurb: "Heart-rate variability reflects autonomic balance. Lower HRV signals stress or poor recovery — key for psychological health on isolated missions.",
    steps: [
      ["Interval series", "Beat-to-beat intervals are taken from the cardiac PPG stream."],
      ["RMSSD", "Root-mean-square of successive differences quantifies variability."],
      ["Recovery score", "Compared against sleep and workload for a readiness estimate."],
      ["Guided breathing", "VEGA can start a paced-breathing exercise on the HUD."],
    ],
    cmd: "VEGA, what's my stress level?",
    wave: "ecg",
  },
];

const toolById = (id) => TOOLS.find((t) => t.id === id);

/* ----------------------------------------------------------
   Danger thresholds + VEGA guidance
   critLo/critHi mark "dangerous"; warnLo/warnHi mark "outside normal".
   Slider ranges run from min (dangerously low) to max (dangerously high).
   ---------------------------------------------------------- */
const LIMITS = {
  cardio:  { min: 30,  max: 180, critLo: 40,  critHi: 140 },
  spo2:    { min: 70,  max: 100, critLo: 90,  critHi: Infinity },
  resp:    { min: 3,   max: 40,  critLo: 6,   critHi: 30 },
  neuro:   { min: 1,   max: 9,   critLo: 1.8, critHi: 8 },
  cog:     { min: 0,   max: 100, critLo: -Infinity, critHi: 85 },
  thermal: { min: 33,  max: 42,  critLo: 35,  critHi: 39 },
  rad:     { min: 0,   max: 10,  critLo: -Infinity, critHi: 5 },
  hrv:     { min: 5,   max: 150, critLo: 15,  critHi: Infinity },
};

const GUIDANCE = {
  cardio: {
    low: { title: "Heart rate too low", why: "A slow heart rate can reduce blood flow to the brain, especially after a change in gravity.",
      steps: ["Stop what you're doing and hold onto a handrail or seat.", "Check yourself for dizziness, confusion or shortness of breath.", "Tell a crewmate and stay where they can see you."],
      danger: "Below 40 bpm: the crew medical officer starts the cardiac protocol and calls the flight surgeon." },
    high: { title: "Heart rate too high", why: "A racing heart at rest can mean dehydration, low oxygen, heat stress or an irregular rhythm.",
      steps: ["Stop exercise or heavy work and rest for five minutes.", "Drink water, and check that cabin O₂ and CO₂ read normal.", "Say “breathing exercise” and follow the paced breathing."],
      danger: "Above 140 bpm at rest: notify the flight surgeon and get the medical kit and defibrillator ready." },
  },
  spo2: {
    low: { title: "Blood oxygen low", why: "Low oxygen impairs judgement within minutes, often before you notice any symptoms.",
      steps: ["Check the suit or cabin O₂ pressure readout now.", "Put on the emergency oxygen mask.", "Move to a module with a known-good atmosphere and tell the crew."],
      danger: "Below 90%: declare a medical emergency and check for a cabin leak or life-support failure." },
  },
  resp: {
    low: { title: "Breathing too slow", why: "Slow breathing lets CO₂ build up. It can follow sedating medication or extreme fatigue.",
      steps: ["Take five slow, deep, deliberate breaths.", "Check whether you've taken any sleep or pain medication.", "Ask a crewmate to stay with you and watch for drowsiness."],
      danger: "Below 6 breaths/min: a crewmate checks your airway and gives oxygen, then calls the flight surgeon." },
    high: { title: "Breathing too fast", why: "Rapid breathing often signals high cabin CO₂, anxiety or a developing breathing problem.",
      steps: ["Slow down: breathe in for 4, out for 6.", "Check the cabin CO₂ reading and the scrubber status.", "If it hasn't settled in two minutes, use the oxygen mask."],
      danger: "Above 30 breaths/min: move to a module with fresh air and notify the flight surgeon." },
  },
  neuro: {
    low: { title: "Pupils very constricted", why: "Very small pupils can come from medication, a toxic exposure or bright glare.",
      steps: ["Move out of bright light and repeat the scan in one minute.", "Review any medication you've taken in the last six hours.", "Check the cabin air-quality alarms for contaminants."],
      danger: "Below 1.8 mm: possible toxic exposure. Put on the mask and alert the crew." },
    high: { title: "Pupils very dilated", why: "Large or slow-reacting pupils can be a sign of raised pressure around the brain or a head injury.",
      steps: ["Stop your current task and stay still.", "Say “run a neuro scan” to compare both eyes.", "Report any headache, blurred vision or nausea."],
      danger: "Above 8 mm: treat it as a possible head injury and contact the flight surgeon now." },
  },
  cog: {
    high: { title: "Fatigue load high", why: "Fatigue slows reaction time and raises error rates during critical operations.",
      steps: ["Pause critical tasks such as EVA, robotics or docking.", "Hand the task to a rested crewmate.", "Take a 20-minute rest and drink some water."],
      danger: "Above 85: you aren't cleared for critical operations until your score drops below 60." },
  },
  thermal: {
    low: { title: "Core temperature low", why: "A falling core temperature reduces dexterity and judgement.",
      steps: ["Raise the suit or cabin temperature.", "Add an insulating layer and drink something warm.", "Stop any cold-soak work, such as EVA in shadow."],
      danger: "Below 35 °C: start the rewarming protocol and call the flight surgeon." },
    high: { title: "Core temperature high", why: "Heat stress or fever. In microgravity sweat doesn't drip away, so the body cools less well.",
      steps: ["Stop exercising and increase suit cooling or cabin airflow.", "Drink fluids with electrolytes.", "Check for signs of fever: chills, aches, sore throat."],
      danger: "Above 39 °C: begin active cooling and notify the flight surgeon." },
  },
  rad: {
    high: { title: "Radiation dose rate high", why: "A spike in dose rate usually means a solar particle event is underway.",
      steps: ["Go to the storm shelter now. Follow the route in your view.", "Stay behind the water-wall shielding until VEGA clears you.", "Log your location and the time for your dose record."],
      danger: "Above 5 mSv/day: shelter-in-place is mandatory and all EVAs are cancelled." },
  },
  hrv: {
    low: { title: "Stress high, HRV low", why: "Low heart-rate variability means your nervous system is under strain or hasn't recovered.",
      steps: ["Say “breathing exercise” and follow the paced breathing.", "Reduce your workload for the next hour if the schedule allows.", "Prioritise sleep tonight and consider a private psych-support call."],
      danger: "Below 15 ms: tell the crew medical officer and repeat the reading after rest." },
  },
};

TOOLS.forEach((t) => Object.assign(t, LIMITS[t.id], { guidance: GUIDANCE[t.id] }));

/* zone: "ok" | "warn" (outside normal) | "crit" (dangerous); side: "low" | "high" */
function zoneOf(tool, v) {
  if (v < tool.critLo) return { zone: "crit", side: "low" };
  if (v > tool.critHi) return { zone: "crit", side: "high" };
  if (v < tool.warnLo) return { zone: "warn", side: "low" };
  if (v > tool.warnHi) return { zone: "warn", side: "high" };
  return { zone: "ok", side: null };
}

function toolStatus(tool, v) { return zoneOf(tool, v).zone; }
