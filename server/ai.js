/* ==========================================================
   AstraSight: ASTRA AI routes (Qwen 2.5 via local Ollama)
   Mounted by server.js. Stateless: the client sends the crew
   profile and live readings with each request, and stores the
   profile itself (e.g. in Firestore).

   GET  /api/ai/status              Ollama + model readiness
   GET  /api/ai/onboard/questions   questionnaire definition
   POST /api/ai/onboard/answer      { questionId, answer, profile }
   POST /api/ai/onboard/finish      { profile }
   POST /api/ai/chat                { messages, profile?, vitals?, context?, stream? }
   POST /api/ai/brief               { vitals, profile?, context? }   (critical-stats screen)
   POST /api/ai/triage              { report, flag?, level?, vitals?, context?, profile? }
                                    (body-map triage on MedGemma; falls back to Qwen)
   POST /api/ai/triage/jobs         same body -> 202 { id }: runs in the background, so the
                                    page can be closed while MedGemma works (report.html)
   GET  /api/ai/triage/jobs/<id>    { id, status: running|done|error, result?, message? }

   See docs/AI-BACKEND.md for the full contract.
   ========================================================== */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const ollama = require("./ollama");
const gemini = require("./gemini");   // questionnaire only, when GEMINI_API_KEY is set (server/gemini.js)
let auth = null;   // optional: face sign-in module (server/auth.js, docs/AUTH.md)
try { auth = require("./auth"); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; }
const { evaluate, worstZone } = require("./registry");
const onboarding = require("./onboarding");

const PERSONA_FILE = path.join(__dirname, "persona.md");
const MAX_BODY = 64 * 1024;
const MAX_TURNS = 16;

/* Words that mean "get a human now", whatever the sensors say. */
const RED_FLAGS = /\b(chest pain|chest tight|pass(ed)? out|faint(ed|ing)?|black(ed)? out|can'?t breathe|cannot breathe|short of breath|vision loss|lost (my )?vision|can'?t see|confus(ed|ion)|worst headache|seizure|unconscious|numb(ness)? (in|on) (my )?(face|arm|leg)|slurred|suicid\w*|kill myself|hurt myself)\b/i;
const MENTIONS_SURGEON = /flight surgeon|medical officer|\bCMO\b/i;
const ESCALATION_LINE = "This needs the flight surgeon. Tell your crew medical officer now, and keep this channel open.";

/* ---------------- helpers ---------------- */
function json(res, code, obj) {
  if (res.headersSent) return res.end(JSON.stringify(obj));   // after keepAlive(): status is already 200
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

/* Slow model calls (MedGemma on a CPU server can take 1–3 minutes) would hit Cloudflare's
   100 s limit for a silent origin. After `after` ms this sends 200 headers and then a space every
   15 s; JSON.parse ignores leading whitespace. An error after that point arrives as 200 with an
   `error` field, so clients must check `j.error` as well as `r.ok`. Returns a stop function. */
function keepAlive(res, after = 10000) {
  let iv = null;
  const start = setTimeout(() => {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    res.keepAliveJson = true;   // fail() reads this: headers from writeHead() aren't visible to getHeader()
    res.write(" ");
    iv = setInterval(() => { if (!res.writableEnded) res.write(" "); }, 15000);
  }, after);
  const stop = () => { clearTimeout(start); clearInterval(iv); };
  res.on("close", stop);
  return stop;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error("Body too large"), { status: 413 });
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("Bad JSON"), { status: 400 });
  }
}

function fail(res, e) {
  const status = e.status || 500;
  if (res.headersSent) {
    // keepAlive() already sent 200 + JSON headers: report the error in the body (unless streaming).
    if (!res.writableEnded && res.keepAliveJson) res.end(JSON.stringify({ error: e.code || "server_error", status, message: e.message }));
    else res.end();
    return;
  }
  if (status >= 500 && !(e instanceof ollama.OllamaError)) console.error("[ai]", e);
  json(res, status, { error: e.code || (status >= 500 ? "server_error" : "bad_request"), message: e.message });
}

/* Abort the model call if the browser goes away (closed sidebar, navigated off). */
function abortOnClose(res) {
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); });
  return ac.signal;
}

function persona() {
  try {
    return fs.readFileSync(PERSONA_FILE, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  } catch {
    return "You are ASTRA, an astronaut health assistant. You flag and suggest, never diagnose, and escalate serious findings to the flight surgeon.";
  }
}

const VERBOSITY = {
  brief: "Keep replies to at most 2 short sentences.",
  standard: "Keep replies to at most 4 sentences unless you're listing steps.",
  detailed: "You can use up to two short paragraphs, and explain the reason behind each suggestion.",
};

function readingLine(r) {
  const zone = r.zone === "ok" ? "NORMAL" : `${r.zone === "crit" ? "DANGER" : "CAUTION"} ${r.side.toUpperCase()}`;
  let line = `- ${r.name}: ${r.value} ${r.unit} — ${zone} (normal for this person: ${r.normal})`;
  if (r.zone !== "ok" && r.steps.length) line += `. Protocol first step: ${r.steps[0]}`;
  if (r.danger) line += ` Danger protocol: ${r.danger}`;
  return line;
}

/*
 * Extra telemetry that isn't a TOOLS indicator, e.g. from report.html during EVA:
 * { "Suit pressure": "4.3 PSI", "Primary O2": "62 %", "DCS R-value": 1.21, "Location": "EVA, truss S1" }
 * Passed to the model as labelled facts. Zones for it are NOT computed here.
 */
function cleanContext(ctx) {
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return [];
  return Object.entries(ctx)
    .filter(([k, v]) => k && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
    .slice(0, 20)
    .map(([k, v]) => `- ${String(k).slice(0, 40)}: ${String(v).slice(0, 120)}`);
}

function systemPrompt(profile, rows, context = [], redFlag = false) {
  const parts = [persona(), "", `Style for this crew member: ${VERBOSITY[profile.verbosity] || VERBOSITY.standard}`];

  const facts = onboarding.profileForModel(profile);
  if (Object.keys(facts).length) parts.push("", `Crew profile (from onboarding): ${JSON.stringify(facts)}`);
  const tl = profile.tailoring;
  if (tl?.summary) parts.push(`Baseline summary: ${tl.summary}`);
  if (tl?.watchItems?.length) parts.push(`Watch items: ${tl.watchItems.map((w) => `[${w.tool}] ${w.note}`).join(" ")}`);

  if (rows.length) {
    parts.push("", `Live readings right now (simulated):`, ...rows.map(readingLine));
  } else {
    parts.push("", "No live readings were sent with this message. Don't quote numbers.");
  }
  if (context.length) parts.push("", "Other telemetry from the current screen (already labelled by the app):", ...context);

  if (rows.some((r) => r.zone === "crit")) {
    parts.push("", "IMPORTANT: at least one reading is in the DANGER zone. Start your reply with it, give the first protocol step, and tell them to contact the flight surgeon and the crew medical officer now. Be short, firm and composed: no exclamation marks, no panic words, and end with one steadying line.");
  } else if (rows.some((r) => r.zone === "warn")) {
    parts.push("", "Situation: CAUTION. At least one reading is in the caution zone. Be friendly but focused: name it, say what it means in a few words, give one next step. No jokes.");
  }
  if (redFlag) {
    parts.push("", "IMPORTANT: the crew member describes a symptom that can be serious. Start your reply by telling them to stop what they're doing and contact the flight surgeon and the crew medical officer now. Don't suggest waiting, relaxing it away, or re-checking later. Then give one short thing they can do while help comes.");
  }
  return parts.join("\n");
}

function cleanMessages(messages) {
  const list = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
    .slice(-MAX_TURNS);
  if (!list.length || list[list.length - 1].role !== "user") {
    throw Object.assign(new Error("messages must end with a user message"), { status: 400 });
  }
  return list;
}

/* ---------------- handlers ---------------- */
async function status(req, res) {
  const [main, med] = await Promise.all([ollama.status(), ollama.status(ollama.MED_MODEL)]);
  json(res, 200, { ...main, medModel: med.model, medModelReady: med.modelReady, onboardModel: gemini.enabled ? gemini.MODEL : main.model, endpoints: ["onboard", "chat", "brief", "triage"] });
}

async function chat(req, res) {
  const body = await readJson(req);
  const messages = cleanMessages(body.messages);
  const profile = onboarding.cleanProfile(body.profile);
  const rows = evaluate(body.vitals, profile);
  const lastUser = messages[messages.length - 1].content;

  const alerts = rows.filter((r) => r.zone !== "ok");
  const redFlag = RED_FLAGS.test(lastUser);
  const escalate = rows.some((r) => r.zone === "crit") || redFlag;
  const llmMessages = [{ role: "system", content: systemPrompt(profile, rows, cleanContext(body.context), redFlag) }, ...messages];
  const signal = abortOnClose(res);

  if (!body.stream) {
    let reply = await ollama.chat({ messages: llmMessages, temperature: 0.5, signal });
    if (escalate && !MENTIONS_SURGEON.test(reply)) reply += `\n\n${ESCALATION_LINE}`;
    return json(res, 200, { reply, escalate, alerts, model: ollama.MODEL });
  }

  // Streaming: NDJSON, one event per line.
  //   {"type":"meta","escalate":bool,"alerts":[...],"model":"..."}
  //   {"type":"delta","text":"..."}            (many)
  //   {"type":"done","reply":"<full text>"}    or {"type":"error","error":"...","message":"..."}
  const stream = ollama.chatStream({ messages: llmMessages, temperature: 0.5, signal });
  let first;
  try {
    first = await stream.next();   // surface "Ollama down" as a normal HTTP error before we commit to 200
  } catch (e) {
    return fail(res, e);
  }
  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const send = (o) => res.write(JSON.stringify(o) + "\n");
  send({ type: "meta", escalate, alerts, model: ollama.MODEL });
  let reply = "";
  try {
    for (let step = first; !step.done; step = await stream.next()) {
      reply += step.value;
      send({ type: "delta", text: step.value });
    }
    if (escalate && !MENTIONS_SURGEON.test(reply)) {
      const extra = `\n\n${ESCALATION_LINE}`;
      reply += extra;
      send({ type: "delta", text: extra });
    }
    send({ type: "done", reply });
  } catch (e) {
    if (e.code !== "aborted") send({ type: "error", error: e.code || "server_error", message: e.message });
  }
  res.end();
}

/*
 * Body-map triage (report.html): MedGemma, a model trained on medical text, lists
 * possible causes to consider, what to do for each (first aid and self-care), and
 * what to check next. It flags and suggests; it does not diagnose, and it never
 * gives drug doses (steps that contain one are dropped here). Escalation is decided in code (rule-based level or a red-flag
 * symptom) and the model can only add to it, never clear it.
 * If MedGemma isn't pulled, the same prompt goes to the general model (Qwen).
 */
const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    possibleCauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          likelihood: { type: "string", enum: ["more likely", "possible", "less likely"] },
          why: { type: "string" },
          whatToDo: { type: "array", items: { type: "string" } },
        },
        required: ["name", "likelihood", "why", "whatToDo"],
      },
    },
    checkNext: { type: "array", items: { type: "string" } },
    escalate: { type: "boolean" },
  },
  required: ["summary", "possibleCauses", "checkNext", "escalate"],
};

function triagePrompt(profile, rows, context) {
  const facts = onboarding.profileForModel(profile);
  return [
    "You are ASTRA's medical reasoning module on a crewed deep-space mission. The crew can't reach a hospital; the flight surgeon is on a delayed link.",
    "A crew member marked symptoms on a body map. Help the crew medical officer think it through.",
    "Rules:",
    "- You do NOT diagnose. List 2 to 4 possible causes to consider, most likely first, each with one short sentence on why it fits.",
    "- Spaceflight causes by body area. Use one only if it fits the area and the symptoms; this is a reminder, not a checklist: joints or limbs during or after an EVA: decompression sickness. Hands, shoulders or feet in a suit: suit or glove pressure points. Eyes, blurred vision or headache: fluid shift and SANS (Spaceflight-Associated Neuro-ocular Syndrome). Nausea, dizziness or headache in the first 2 to 3 days: space motion sickness. Lower back in the first weeks of flight: back pain from the spine lengthening in microgravity. Side or flank pain, blood in the urine: kidney stones (bone loss raises urine calcium). Muscles after exercise: strain. Nausea, skin redness or fatigue after a solar event: radiation exposure.",
    "- Suggest suit or glove fixes only if the symptoms started in a suit or during an EVA.",
    "- Decompression sickness (DCS) is a real risk after any EVA (suit pressure is about 4.3 psi), not only in diving. If onset is during or after an EVA and the symptom is joint or limb pain, numbness, tingling, skin mottling, or anything neurological, list DCS first as \"more likely\". If there was no EVA or pressure change, don't list DCS.",
    "- whatToDo: for each cause, 2 or 3 short imperative steps the crew can take now if that cause is right: first aid, self-care, and spaceflight countermeasures (rest the area, cold pack, loosen or refit the suit or glove, hydrate, adjust exercise, keep the head still and look at a fixed point for nausea, move to the radiation shelter).",
    "- For suspected DCS, whatToDo is: stop the EVA or postpone the next one, start 100% oxygen per the mission DCS protocol, and call the flight surgeon now. Don't rub or heat the joint.",
    "- Medicines: you may say a kind of medicine from the onboard kit is worth asking the crew medical officer about (for example, a pain reliever or an anti-nausea medicine). Never give a drug name with a dose, an amount, or how often to take it; the flight surgeon decides that.",
    "- checkNext: 2 to 4 short, concrete things the crew can check or record now.",
    "- escalate: true if a likely cause could be serious or time-critical (DCS, neurological signs, chest pain, breathing trouble, vision loss, severe or worsening pain). Expected, self-limiting problems such as space motion sickness or a mild strain don't need escalation.",
    "- summary: one plain sentence. Keep everything short; it shows in a small panel.",
    Object.keys(facts).length ? `Crew profile: ${JSON.stringify(facts)}` : "",
    rows.length ? `Live readings (simulated):\n${rows.map(readingLine).join("\n")}` : "",
    context.length ? `Telemetry from the screen:\n${context.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
/* Onset text comes from report.html's onset select ("During EVA", "Immediately after EVA", "Delayed after EVA") or crew notes. */
const POST_EVA = /\b(during|after|following|post-?)\s+(an?\s+|the\s+)?EVA\b|\bpost-?EVA\b|\bafter (a |the )?spacewalk\b/i;
const DCS_SIGNS = /\b(pain\w*|ache|aching|joint|numb\w*|tingl\w*|pins and needles|mottl\w*|itch\w*|rash|weak\w*|swell\w*|confus\w*|dizz\w*|vision|visual)\b/i;
const DCS_STEPS = ["Stop the EVA, or postpone the next one.", "Start 100% oxygen per the mission DCS protocol.", "Call the flight surgeon now. Don't rub or heat the joint."];
/* A step with a dose ("400 mg", "2 tablets", "every 6 hours") is the flight surgeon's call, not the AI's. */
const DOSE = /\b\d+(\.\d+)?\s*(mg|mcg|µg|g|cc|units?|iu|tablets?|tabs?|pills?|capsules?|puffs?|drops?)\b|\bevery \d+\s*(h|hours?)\b/i;

async function triage(req, res) {
  const body = await readJson(req);
  const signal = abortOnClose(res);
  const stopKeepAlive = keepAlive(res);
  try {
    const out = await triageResult(body, signal);
    stopKeepAlive();
    json(res, 200, out);
  } catch (e) {
    stopKeepAlive();
    throw e;
  }
}

/* Background triage jobs: MedGemma on a CPU server takes 1-5 minutes, and the crew shouldn't have to
   keep the report page open. Jobs live in memory (lost on restart) for 2 hours; the id is random and
   is the only way to read the result. */
const JOBS = new Map();
const JOB_TTL = 2 * 3600 * 1000, MAX_JOBS = 200;
async function triageJobStart(req, res) {
  const body = await readJson(req);
  if (!str(body.report, 2000)) throw Object.assign(new Error("report is required"), { status: 400 });
  const now = Date.now();
  for (const [id, j] of JOBS) if (now - j.created > JOB_TTL) JOBS.delete(id);
  if (JOBS.size >= MAX_JOBS) throw Object.assign(new Error("Too many reviews queued. Try again in a few minutes."), { status: 503, code: "busy" });
  const id = crypto.randomBytes(12).toString("base64url");
  const job = { status: "running", created: now };
  JOBS.set(id, job);
  triageResult(body)
    .then((result) => { job.status = "done"; job.result = result; })
    .catch((e) => { job.status = "error"; job.message = e.message; job.code = e.code || "server_error"; console.error("[ai] triage job failed:", e.message); })
    .finally(() => { job.finished = Date.now(); });
  json(res, 202, { id, status: "running" });
}
function triageJobGet(req, res, id) {
  const job = JOBS.get(id);
  if (!job) return json(res, 404, { error: "not_found", message: "No such review. The server may have restarted; run the review again." });
  json(res, 200, { id, status: job.status, result: job.result, message: job.message, code: job.code });
}

async function triageResult(body, signal) {
  const report = str(body.report, 2000);
  if (!report) throw Object.assign(new Error("report is required"), { status: 400 });
  const profile = onboarding.cleanProfile(body.profile);
  const rows = evaluate(body.vitals, profile);
  const ruleEscalate = body.level === "critical" || RED_FLAGS.test(report) || rows.some((r) => r.zone === "crit");
  const messages = [
    { role: "system", content: triagePrompt(profile, rows, cleanContext(body.context)) },
    { role: "user", content: `${report}${body.flag ? `\nThe rule-based screen flagged: ${str(body.flag, 200)}.` : ""}` },
  ];
  let out, model = ollama.MED_MODEL, fallback = false;
  try {
    out = await ollama.chat({ model, messages, format: TRIAGE_SCHEMA, temperature: 0.2, signal });
  } catch (e) {
    if (e.code !== "model_missing" || ollama.MED_MODEL === ollama.MODEL) throw e;
    console.warn(`[ai] ${e.message}. Triage is using ${ollama.MODEL} instead.`);
    model = ollama.MODEL; fallback = true;
    out = await ollama.chat({ model, messages, format: TRIAGE_SCHEMA, temperature: 0.2, signal });
  }

  const possibleCauses = (Array.isArray(out.possibleCauses) ? out.possibleCauses : [])
    .filter((c) => c && str(c.name, 80))
    .slice(0, 4)
    .map((c) => ({
      name: str(c.name, 80),
      likelihood: ["more likely", "possible", "less likely"].includes(c.likelihood) ? c.likelihood : "possible",
      why: str(c.why, 220),
      whatToDo: (Array.isArray(c.whatToDo) ? c.whatToDo : []).map((x) => str(x, 180)).filter((x) => x && !DOSE.test(x)).slice(0, 3),
    }));
  const checkNext = (Array.isArray(out.checkNext) ? out.checkNext : []).map((x) => str(x, 180)).filter(Boolean).slice(0, 4);
  // Same cause twice ("Space motion sickness" and "Motion sickness"): keep the first.
  const seen = new Set();
  for (let i = possibleCauses.length - 1; i >= 0; i--) possibleCauses[i].key = possibleCauses[i].name.toLowerCase().replace(/^space\s+|\s*\(.*\)$/g, "");
  possibleCauses.splice(0, possibleCauses.length, ...possibleCauses.filter((c) => !seen.has(c.key) && seen.add(c.key)).map(({ key, ...c }) => c));

  // Pain, numbness, tingling or skin changes during or after an EVA are treated as DCS until
  // the flight surgeon rules it out. A 4B model doesn't hold that reliably, so code enforces it.
  const postEva = POST_EVA.test(report);
  if (postEva && DCS_SIGNS.test(report)) {
    const i = possibleCauses.findIndex((c) => /decompression|\bDCS\b/i.test(c.name));
    if (i >= 0) possibleCauses.splice(i, 1);
    possibleCauses.unshift({
      name: "Decompression sickness (DCS)",
      likelihood: "more likely",
      why: "Pain, numbness, tingling or skin changes during or after an EVA count as DCS until the flight surgeon rules it out.",
      whatToDo: DCS_STEPS,
    });
    possibleCauses.splice(4);
  } else if (!postEva) {
    // No EVA, no DCS: the model sometimes lists it anyway.
    const i = possibleCauses.findIndex((c) => /decompression|\bDCS\b/i.test(c.name));
    if (i >= 0 && possibleCauses.length > 1) possibleCauses.splice(i, 1);
  }

  const RANK = { "more likely": 0, possible: 1, "less likely": 2 };
  possibleCauses.sort((a, b) => RANK[a.likelihood] - RANK[b.likelihood]);   // stable: model order within a tier

  const escalate = ruleEscalate || out.escalate === true || (postEva && DCS_SIGNS.test(report));
  if (escalate && !checkNext.some((a) => MENTIONS_SURGEON.test(a))) checkNext.unshift(ESCALATION_LINE);

  return { summary: str(out.summary, 300), possibleCauses, checkNext, escalate, model, fallback, disclaimer: "AI suggestion, not a diagnosis or a prescription. Confirm with the flight surgeon." };
}

/* Critical-stats screen: a short ASTRA briefing. Status and escalation are decided in code, the words by Qwen. */
async function brief(req, res) {
  const body = await readJson(req);
  const profile = onboarding.cleanProfile(body.profile);
  const rows = evaluate(body.vitals, profile);
  if (!rows.length) throw Object.assign(new Error("vitals must include at least one known tool id"), { status: 400 });

  const status = worstZone(rows);
  const escalate = status === "crit";
  const flagged = rows.filter((r) => r.zone !== "ok");

  // Offline fallback, also used if the model fails: built from js/data.js guidance.
  const fallback = {
    headline: status === "ok" ? "All readings are in your normal range."
      : `${flagged.length} reading${flagged.length > 1 ? "s" : ""} need${flagged.length > 1 ? "" : "s"} attention: ${flagged.map((r) => r.short).join(", ")}.`,
    notes: Object.fromEntries(flagged.map((r) => [r.id, r.title])),
    actions: [...new Set(flagged.flatMap((r) => (r.danger ? [r.danger, r.steps[0]] : [r.steps[0]])).filter(Boolean))].slice(0, 4),
  };
  if (escalate && !fallback.actions.some((a) => MENTIONS_SURGEON.test(a))) fallback.actions.unshift(ESCALATION_LINE);

  let out = fallback, source = "rules";
  try {
    const r = await ollama.chat({
      messages: [
        { role: "system", content: `${systemPrompt(profile, rows, cleanContext(body.context))}\n\nYou are writing the critical-stats screen in the lens. Be terse.\n- headline: one sentence, max 14 words, on overall status.\n- notes: one short note (max 12 words) per reading id, saying what it means for this person.\n- actions: up to 4 short imperative steps, most urgent first. Empty if everything is normal.` },
        { role: "user", content: "Brief me." },
      ],
      format: {
        type: "object",
        properties: {
          headline: { type: "string" },
          notes: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: rows.map((x) => x.id) }, note: { type: "string" } }, required: ["id", "note"] } },
          actions: { type: "array", items: { type: "string" } },
        },
        required: ["headline", "notes", "actions"],
      },
      temperature: 0.2,
      signal: abortOnClose(res),
    });
    if (typeof r.headline === "string" && r.headline.trim()) {
      const actions = (r.actions || []).filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim().slice(0, 160)).slice(0, 4);
      out = {
        // Small models sometimes call a danger reading "nominal", so when anything is flagged
        // the headline and the minimum actions come from code; the model adds per-reading notes.
        headline: status === "ok" ? r.headline.trim().slice(0, 160) : fallback.headline,
        notes: Object.fromEntries((r.notes || []).filter((n) => n && typeof n.note === "string" && n.note.trim()).map((n) => [n.id, n.note.trim().slice(0, 120)])),
        actions: status === "ok" ? actions : [...new Set([...fallback.actions, ...actions])].slice(0, 5),
      };
      if (escalate && !out.actions.some((a) => MENTIONS_SURGEON.test(a))) out.actions.unshift(ESCALATION_LINE);
      source = "model";
    }
  } catch (e) {
    if (e.code === "aborted") return;
  }

  json(res, 200, {
    status, escalate,
    headline: out.headline,
    readings: rows.map(({ steps, ...r }) => ({ ...r, note: out.notes[r.id] || fallback.notes[r.id] || null })),
    actions: out.actions,
    source, model: source === "model" ? ollama.MODEL : null,
    generatedAt: new Date().toISOString(),
  });
}

/* The questionnaire waits on the model after every answer, so it uses Gemini Flash when a key is
   set (a few seconds instead of up to a minute on a CPU server), falling back to Ollama (Qwen). */
function onboardChat(res) {
  const signal = abortOnClose(res);
  return async (o) => {
    if (gemini.enabled) {
      try { return await gemini.chat({ ...o, signal }); }
      catch (e) {
        if (e.code === "aborted") throw e;
        console.warn(`[ai] Gemini failed (${e.message}); the questionnaire uses ${ollama.MODEL} instead.`);
      }
    }
    return ollama.chat({ ...o, signal });
  };
}

async function onboardAnswer(req, res) {
  const body = await readJson(req);
  json(res, 200, await onboarding.answer({ chat: onboardChat(res) }, body));
}

async function onboardFinish(req, res) {
  const body = await readJson(req);
  json(res, 200, await onboarding.finish({ chat: onboardChat(res) }, body));
}

const ROUTES = {
  "GET /api/ai/status": status,
  "GET /api/ai/onboard/questions": (req, res) => json(res, 200, { questions: onboarding.publicQuestions() }),
  "POST /api/ai/onboard/answer": onboardAnswer,
  "POST /api/ai/onboard/finish": onboardFinish,
  "POST /api/ai/chat": chat,
  "POST /api/ai/brief": brief,
  "POST /api/ai/triage": triage,
  "POST /api/ai/triage/jobs": triageJobStart,
};
const JOB_URL = /^\/api\/ai\/triage\/jobs\/([\w-]{8,40})$/;

/*
 * Sign-in check (server/auth.js, docs/AUTH.md). In Firebase mode every route except
 * /status needs "Authorization: Bearer <await AstraAuth.getIdToken()>". In local mode
 * there are no tokens, so the routes stay open for offline demos.
 * AI_REQUIRE_AUTH=0 in .env turns the check off even in Firebase mode.
 */
const OPEN_ROUTES = new Set(["GET /api/ai/status", "GET /api/ai/onboard/questions"]);
const REQUIRE_AUTH = process.env.AI_REQUIRE_AUTH !== "0" && auth?.mode === "firebase";

/** Returns true if the request was an /api/ai route (handled here). */
function handle(req, res) {
  const url = req.url.split("?")[0];
  if (!url.startsWith("/api/ai/")) return false;
  const key = `${req.method} ${url}`;
  const jobId = req.method === "GET" && (url.match(JOB_URL) || [])[1];
  const fn = jobId ? (rq, rs) => triageJobGet(rq, rs, jobId) : ROUTES[key];
  if (!fn) {
    json(res, 404, { error: "not_found", message: `No route ${req.method} ${url}` });
    return true;
  }
  Promise.resolve()
    .then(async () => {
      if (REQUIRE_AUTH && !OPEN_ROUTES.has(key) && !(await auth.userFromRequest(req))) {
        throw Object.assign(new Error("Sign in first: send Authorization: Bearer <AstraAuth.getIdToken()>"), { status: 401, code: "unauthorized" });
      }
      return fn(req, res);
    })
    .catch((e) => fail(res, e));
  return true;
}

module.exports = { handle, RED_FLAGS }; // RED_FLAGS is shared with the HUD's /api/chat in server.js
