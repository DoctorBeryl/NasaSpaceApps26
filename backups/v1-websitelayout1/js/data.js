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

function toolStatus(tool, v) {
  if (v < tool.warnLo || v > tool.warnHi) return "warn";
  return "ok";
}
