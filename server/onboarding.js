/* ==========================================================
   AstraSight: first-login questionnaire ("tailoring")
   - A fixed question bank, so the flow works even without Qwen.
   - Qwen turns free-text answers into structured fields, may ask
     one follow-up, and writes the final tailoring.
   - Numbers that change alerting are clamped in code and marked
     "proposed" until the flight surgeon signs off.
   ========================================================== */
const { TOOLS, TOOL_IDS, byId } = require("./registry");

const opts = (...pairs) => pairs.map(([value, label]) => ({ value, label }));

/* kind: "text" -> Qwen extracts `schema`; "choice"/"multi" -> stored as-is, no model call */
const QUESTIONS = [
  {
    id: "callsign", topic: "About you", kind: "text",
    text: "Hi, I'm VEGA. What should I call you? A first name or a call sign is fine.",
    placeholder: "e.g. Nova",
    schema: { callsign: { type: "string", description: "Name or call sign to address them by, max 3 words" } },
  },
  {
    id: "role", topic: "About you", kind: "choice",
    text: "What's your role on this mission?",
    field: "role",
    options: opts(["commander", "Commander"], ["pilot", "Pilot"], ["flight-engineer", "Flight engineer"], ["mission-specialist", "Mission specialist"], ["payload-specialist", "Payload specialist"], ["other", "Other"]),
  },
  {
    id: "mission", topic: "Mission", kind: "text",
    text: "What kind of mission is this, and roughly how long will it run?",
    placeholder: "e.g. six months on the ISS",
    schema: {
      missionType: { type: "string", enum: ["leo", "lunar", "mars-transit", "mars-surface", "analog", "other"], description: "leo = ISS or other low Earth orbit; analog = ground analog like HERA" },
      durationDays: { type: "integer", description: "Mission length in days, 0 if not stated" },
    },
  },
  {
    id: "fitness", topic: "Baselines", kind: "text",
    text: "Tell me about your usual exercise. If you know your resting heart rate, include it.",
    placeholder: "e.g. I run most days, resting HR about 52",
    schema: {
      exerciseLevel: { type: "string", enum: ["low", "moderate", "high", "athlete", "unknown"] },
      restingHr: { type: "integer", description: "Resting heart rate in bpm if they stated one, else 0" },
    },
  },
  {
    id: "sleep", topic: "Baselines", kind: "text",
    text: "How many hours do you usually sleep, and do you use anything to help you sleep?",
    placeholder: "e.g. about 7 hours, melatonin sometimes",
    schema: {
      sleepHours: { type: "number", description: "Typical hours of sleep per night, 0 if not stated" },
      sleepAids: { type: "boolean", description: "True if they use any sleep medication or aid" },
    },
  },
  {
    id: "medical", topic: "Health context", kind: "text", optional: true,
    text: "Is there any condition or medication you'd like me to keep in mind? You can skip this. Your flight surgeon already has your full record.",
    placeholder: "Optional",
    schema: {
      conditions: { type: "array", items: { type: "string" }, description: "Conditions they mentioned, as short phrases; empty if none" },
      medications: { type: "array", items: { type: "string" }, description: "Medications they mentioned; empty if none" },
      allergies: { type: "array", items: { type: "string" }, description: "Allergies they mentioned; empty if none" },
    },
  },
  {
    id: "history", topic: "Health context", kind: "multi",
    text: "Have you had any of these on earlier flights or in training?",
    field: "history",
    options: opts(["motion-sickness", "Space motion sickness"], ["headaches", "Headaches"], ["vision-changes", "Vision changes"], ["back-pain", "Back pain"], ["sleep-trouble", "Trouble sleeping"], ["first-flight", "None, or this is my first flight"]),
  },
  {
    id: "stress", topic: "Wellbeing", kind: "text",
    text: "When you're stressed or worn out, what helps you most?",
    placeholder: "e.g. music, a call home, a short workout",
    schema: {
      copingPrefs: { type: "array", items: { type: "string" }, description: "Things that help them, as short phrases" },
      wantsCheckIns: { type: "boolean", description: "True unless they said they don't want VEGA to check in on them" },
    },
  },
  {
    id: "verbosity", topic: "How I talk to you", kind: "choice",
    text: "How much detail do you want from me?",
    field: "verbosity",
    options: opts(["brief", "Brief: just the number and what to do"], ["standard", "Standard"], ["detailed", "Detailed: explain the why"]),
  },
  {
    id: "alertMode", topic: "How I talk to you", kind: "choice",
    text: "When a reading leaves your normal range, how should I tell you?",
    field: "alertMode",
    options: opts(["voice-and-visual", "Voice and lens popup"], ["visual", "Lens popup only"], ["quiet-on-task", "Popup only during EVA and critical tasks, voice otherwise"]),
  },
  {
    id: "focus", topic: "Your HUD", kind: "multi",
    text: "Which readings do you want pinned to the top of your side panel? Pick up to four.",
    field: "focusTools", max: 4,
    options: TOOLS.map((t) => ({ value: t.id, label: t.short })),
  },
];

const byQid = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/* What the frontend needs to render the questionnaire (no schemas). */
function publicQuestions() {
  return QUESTIONS.map(({ schema, field, ...q }) => q);
}

/* ---------------- profile shape ---------------- */
const str = (v, n = 80) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const strList = (v, n = 8, len = 80) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, n) : []);
const num = (v, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);

/** Keep only known fields with sane types. Profiles come from the client, so never trust them. */
function cleanProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) p = {};
  const enumOf = (v, q) => (byQid[q].options.some((o) => o.value === v) ? v : null);
  const multiOf = (v, q) => (Array.isArray(v) ? v.filter((x) => byQid[q].options.some((o) => o.value === x)) : []);
  const out = {
    version: 1,
    callsign: str(p.callsign, 40) || null,
    role: enumOf(p.role, "role"),
    missionType: ["leo", "lunar", "mars-transit", "mars-surface", "analog", "other"].includes(p.missionType) ? p.missionType : null,
    durationDays: num(p.durationDays, 1, 3000),
    exerciseLevel: ["low", "moderate", "high", "athlete"].includes(p.exerciseLevel) ? p.exerciseLevel : null,
    restingHr: num(p.restingHr, 30, 120),
    sleepHours: num(p.sleepHours, 2, 14),
    sleepAids: typeof p.sleepAids === "boolean" ? p.sleepAids : null,
    conditions: strList(p.conditions),
    medications: strList(p.medications),
    allergies: strList(p.allergies),
    history: multiOf(p.history, "history"),
    copingPrefs: strList(p.copingPrefs),
    wantsCheckIns: typeof p.wantsCheckIns === "boolean" ? p.wantsCheckIns : true,
    verbosity: enumOf(p.verbosity, "verbosity") || "standard",
    alertMode: enumOf(p.alertMode, "alertMode") || "voice-and-visual",
    focusTools: multiOf(p.focusTools, "focus").slice(0, 4),
    answers: {},
  };
  for (const [k, v] of Object.entries(p.answers || {})) if (byQid[k.replace(/\.followup$/, "")]) out.answers[k] = str(v, 600);
  const tl = p.tailoring;
  if (tl && typeof tl === "object") {
    const thresholds = {};
    for (const [id, b] of Object.entries(tl.thresholds || {})) {
      const band = b && clampBand(id, Number(b.warnLo), Number(b.warnHi));   // never trust stored numbers
      if (band) thresholds[id] = { ...band, reason: str(b.reason, 200), source: str(b.source, 20), status: str(b.status, 20) || "proposed" };
    }
    out.tailoring = {
      summary: str(tl.summary, 600),
      welcome: str(tl.welcome, 300),
      focusTools: multiOf(tl.focusTools, "focus").slice(0, 4),
      thresholds,
      watchItems: (Array.isArray(tl.watchItems) ? tl.watchItems : []).slice(0, 6)
        .map((w) => ({ tool: TOOL_IDS.includes(w?.tool) ? w.tool : "general", note: str(w?.note, 200) })).filter((w) => w.note),
      flightSurgeonNotes: strList(tl.flightSurgeonNotes, 5, 200),
      source: str(tl.source, 20),
      generatedAt: str(tl.generatedAt, 40),
    };
  }
  return out;
}

/** Profile without raw answers or bookkeeping: what we show the model. */
function profileForModel(p) {
  const { answers, tailoring, version, ...rest } = p;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)));
}

/* ---------------- answering one question ---------------- */

/* Rough parsing for when Qwen is offline, so the demo still fills the basics. */
function fallbackExtract(q, answer) {
  const a = answer.toLowerCase();
  if (q.id === "callsign") return { callsign: answer.replace(/^(call me|i'm|i am|it's|my name is)\s+/i, "").split(/[.,!]/)[0].trim().slice(0, 40) };
  if (q.id === "fitness") {
    const m = a.match(/(\d{2,3})\s*(bpm|beats)/) || a.match(/resting[^0-9]{0,20}(\d{2,3})/);
    return m ? { restingHr: Number(m[1]) } : {};
  }
  if (q.id === "sleep") {
    const m = a.match(/(\d+(?:\.\d+)?)\s*(h|hours|hrs)/);
    return m ? { sleepHours: Number(m[1]) } : {};
  }
  if (q.id === "mission") {
    const type = /iss|station|orbit|leo/.test(a) ? "leo" : /moon|lunar|artemis|gateway/.test(a) ? "lunar" : /mars/.test(a) ? "mars-transit" : null;
    return type ? { missionType: type } : {};
  }
  return {};
}

function extractionPrompt(q, answer, isFollowUp) {
  return [
    `You are filling in an astronaut's health-assistant profile from their answer to one onboarding question.`,
    `Question: "${q.text}"`,
    `Answer: "${answer}"`,
    ``,
    `Rules:`,
    `- Only use what the answer says. Never invent values. Use 0, "unknown", false or [] when the answer doesn't say.`,
    `- "ack" is a short, warm reply from VEGA (max 15 words) that acknowledges the answer. Don't ask anything in it. Don't give medical advice.`,
    isFollowUp
      ? `- "followUp" must be an empty string.`
      : `- "followUp": if the answer is too vague to fill the fields, write ONE short clarifying question. Otherwise an empty string. Never ask follow-ups about medical conditions or medications; the flight surgeon holds that record.`,
  ].join("\n");
}

/**
 * Process one answer. Returns { patch, profile, ack, followUp, source }.
 * `ai` is the Ollama client (injected so tests can stub it).
 */
async function answer(ai, { questionId, answer: rawAnswer, profile: rawProfile }) {
  const baseId = String(questionId || "").replace(/\.followup$/, "");
  const isFollowUp = baseId !== questionId;
  const q = byQid[baseId];
  if (!q) throw Object.assign(new Error(`Unknown questionId "${questionId}"`), { status: 400 });

  const profile = cleanProfile(rawProfile);
  let patch = {}, ack = "Got it.", followUp = null, source = "rules";

  if (q.kind === "choice" || q.kind === "multi") {
    const values = q.kind === "multi" ? [].concat(rawAnswer || []) : rawAnswer;
    patch[q.field] = values;
    profile.answers[questionId] = [].concat(values).join(", ");
  } else {
    const text = str(rawAnswer, 600);
    profile.answers[questionId] = text;
    if (!text) {
      if (!q.optional) throw Object.assign(new Error("Empty answer"), { status: 400 });
      ack = "No problem, we can skip that.";
    } else {
      try {
        const out = await ai.chat({
          messages: [
            { role: "system", content: extractionPrompt(q, text, isFollowUp) },
            { role: "user", content: text },
          ],
          format: {
            type: "object",
            properties: { ...q.schema, ack: { type: "string" }, followUp: { type: "string" } },
            required: [...Object.keys(q.schema), "ack", "followUp"],
          },
          temperature: 0.1,
        });
        for (const k of Object.keys(q.schema)) patch[k] = out[k];
        const said = str(out.ack, 160);
        if (said.length > 3 && !/^ack\b/i.test(said)) ack = said;   // small models sometimes echo the field name
        followUp = !isFollowUp && str(out.followUp, 200) ? { id: `${q.id}.followup`, topic: q.topic, kind: "text", text: str(out.followUp, 200) } : null;
        source = "model";
      } catch (e) {
        if (e.code === "aborted") throw e;
        patch = fallbackExtract(q, text);
        source = "rules";
      }
    }
  }

  // A follow-up answer only fills gaps; it doesn't wipe what the first answer gave us.
  if (isFollowUp) for (const k of Object.keys(patch)) if (profile[k] !== null && profile[k] !== undefined && !(Array.isArray(profile[k]) && !profile[k].length)) {
    const v = patch[k];
    if (v === 0 || v === "unknown" || v === "" || (Array.isArray(v) && !v.length)) delete patch[k];
  }

  const merged = cleanProfile({ ...profile, ...patch });
  // Report only the fields that survived cleaning.
  const cleanPatch = Object.fromEntries(Object.keys(patch).map((k) => [k, merged[k]]));
  return { patch: cleanPatch, profile: merged, ack, followUp, source };
}

/* ---------------- finishing: tailoring ---------------- */

const DEFAULT_FOCUS = ["cardio", "spo2", "cog", "hrv"];

/**
 * Clamp a proposed personal caution line. Danger (crit) lines never move.
 * A caution line may shift at most half the gap between its default and the
 * danger line, in either direction, so neither the model nor an edited
 * profile can erase the caution zone or make it fire constantly.
 * Only sides that have guidance can move (e.g. no low-side alert for radiation).
 */
const MAX_SHIFT = 0.5;
function clampBand(id, warnLo, warnHi) {
  const t = byId[id];
  if (!t) return null;
  const round = (v) => Number(v.toFixed(t.decimals));
  const side = (proposed, def, crit) => {
    if (!Number.isFinite(proposed) || !Number.isFinite(crit)) return def;
    const room = Math.abs(def - crit) * MAX_SHIFT;
    return round(Math.min(Math.max(proposed, def - room), def + room));
  };
  const wl = t.guidance?.low ? side(warnLo, t.warnLo, t.critLo) : t.warnLo;
  const wh = t.guidance?.high ? side(warnHi, t.warnHi, t.critHi) : t.warnHi;
  if (wl >= wh) return null;
  if (wl === t.warnLo && wh === t.warnHi) return null;   // no change
  return { warnLo: wl, warnHi: wh };
}

/* Deterministic baseline rules: these don't need the model. */
function baselineThresholds(p) {
  const out = {};
  if (p.restingHr && p.restingHr - 8 < byId.cardio.warnLo) {
    const band = clampBand("cardio", p.restingHr - 8, byId.cardio.warnHi);
    if (band) out.cardio = { ...band, reason: `Resting heart rate reported as ${p.restingHr} bpm, so the low caution line moves to ${band.warnLo} bpm to cut false alarms.`, source: "baseline-rule", status: "proposed" };
  }
  return out;
}

function fallbackTailoring(p) {
  const name = p.callsign || "crew member";
  const bits = [
    p.role && `Role: ${p.role.replace(/-/g, " ")}.`,
    p.missionType && `Mission: ${p.missionType}${p.durationDays ? `, about ${p.durationDays} days` : ""}.`,
    p.restingHr && `Reported resting HR ${p.restingHr} bpm.`,
    p.sleepHours && `Usually sleeps ${p.sleepHours} h${p.sleepAids ? " with a sleep aid" : ""}.`,
    p.history.length && `History: ${p.history.join(", ")}.`,
  ].filter(Boolean);
  return {
    summary: bits.join(" ") || "Profile created with default ranges.",
    welcome: `You're all set, ${name}. I'll watch your readings against your own baseline and tell you if anything changes.`,
    watchItems: [],
    flightSurgeonNotes: [],
    proposals: [],
    focus: [],
  };
}

async function finish(ai, { profile: rawProfile }) {
  const p = cleanProfile(rawProfile);
  let t, source = "model";
  try {
    const out = await ai.chat({
      messages: [
        {
          role: "system",
          content: [
            `You are VEGA, the on-board health assistant in an astronaut's smart glasses. Onboarding just finished.`,
            `Using ONLY the profile below, write the tailoring for this crew member.`,
            `- summary: 2-3 plain sentences for the flight surgeon describing the baseline and anything to watch.`,
            `- welcome: 1-2 warm sentences to the crew member, by call sign, saying what you'll focus on. No medical advice.`,
            `- watchItems: things in the profile that should change how readings are read (e.g. a medication known to lower heart rate, history of motion sickness, short sleep). "tool" is one of: ${TOOL_IDS.join(", ")}, or "general". Empty if nothing applies.`,
            `- flightSurgeonNotes: questions the flight surgeon should confirm. Empty if none.`,
            `- focusTools: up to 4 tool ids that matter most for this person.`,
            `- thresholdProposals: only if the profile gives a clear reason to move a caution line (not a danger line). Usually empty.`,
            `You never diagnose. Don't invent facts that aren't in the profile.`,
            ``,
            `Tools: ${TOOLS.map((x) => `${x.id} = ${x.name} (${x.unit}, normal ${x.warnLo}..${x.warnHi})`).join("; ")}`,
            ``,
            `Profile: ${JSON.stringify(profileForModel(p))}`,
          ].join("\n"),
        },
        { role: "user", content: "Write my tailoring." },
      ],
      format: {
        type: "object",
        properties: {
          summary: { type: "string" },
          welcome: { type: "string" },
          watchItems: { type: "array", items: { type: "object", properties: { tool: { type: "string" }, note: { type: "string" } }, required: ["tool", "note"] } },
          flightSurgeonNotes: { type: "array", items: { type: "string" } },
          focusTools: { type: "array", items: { type: "string", enum: TOOL_IDS } },
          thresholdProposals: { type: "array", items: { type: "object", properties: { tool: { type: "string", enum: TOOL_IDS }, warnLo: { type: "number" }, warnHi: { type: "number" }, reason: { type: "string" } }, required: ["tool", "warnLo", "warnHi", "reason"] } },
        },
        required: ["summary", "welcome", "watchItems", "flightSurgeonNotes", "focusTools", "thresholdProposals"],
      },
      temperature: 0.3,
    });
    t = {
      summary: str(out.summary, 600),
      welcome: str(out.welcome, 300),
      watchItems: (out.watchItems || []).filter((w) => w && str(w.note)).slice(0, 6)
        .map((w) => ({ tool: TOOL_IDS.includes(w.tool) ? w.tool : "general", note: str(w.note, 200) })),
      flightSurgeonNotes: strList(out.flightSurgeonNotes, 5, 200),
      proposals: out.thresholdProposals || [],
      focus: (out.focusTools || []).filter((id) => TOOL_IDS.includes(id)),
    };
    if (!t.summary || !t.welcome) throw new Error("empty");
  } catch (e) {
    if (e.code === "aborted") throw e;
    t = fallbackTailoring(p);
    source = "rules";
  }

  const thresholds = {};
  for (const pr of t.proposals.slice(0, 4)) {
    const band = clampBand(pr.tool, Number(pr.warnLo), Number(pr.warnHi));
    if (band) thresholds[pr.tool] = { ...band, reason: str(pr.reason, 200), source: "vega", status: "proposed" };
  }
  Object.assign(thresholds, baselineThresholds(p));   // explicit baseline rules win over the model

  p.tailoring = {
    summary: t.summary,
    welcome: t.welcome,
    focusTools: p.focusTools.length ? p.focusTools : [...new Set([...t.focus, ...DEFAULT_FOCUS])].slice(0, 4),
    thresholds,
    watchItems: t.watchItems,
    flightSurgeonNotes: t.flightSurgeonNotes,
    source,
    generatedAt: new Date().toISOString(),
  };
  return { profile: p };
}

module.exports = { QUESTIONS, publicQuestions, answer, finish, cleanProfile, profileForModel, clampBand };
