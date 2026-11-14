/* ==========================================================
   AstraSight: VEGA AI routes (Qwen 2.5 via local Ollama)
   Mounted by server.js. Stateless: the client sends the crew
   profile and live readings with each request, and stores the
   profile itself (e.g. in Firestore).

   GET  /api/ai/status              Ollama + model readiness
   GET  /api/ai/onboard/questions   questionnaire definition
   POST /api/ai/onboard/answer      { questionId, answer, profile }
   POST /api/ai/onboard/finish      { profile }
   POST /api/ai/chat                { messages, profile?, vitals?, context?, stream? }
   POST /api/ai/brief               { vitals, profile?, context? }   (critical-stats screen)

   See docs/AI-BACKEND.md for the full contract.
   ========================================================== */
const fs = require("fs");
const path = require("path");
const ollama = require("./ollama");
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
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
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
  if (res.headersSent) return res.end();
  const status = e.status || 500;
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
    return "You are VEGA, an astronaut health assistant. You flag and suggest, never diagnose, and escalate serious findings to the flight surgeon.";
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

function systemPrompt(profile, rows, context = []) {
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
    parts.push("", "IMPORTANT: at least one reading is in the DANGER zone. Start your reply with it, give the first protocol step, and tell them to contact the flight surgeon and the crew medical officer now.");
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
  json(res, 200, { ...(await ollama.status()), endpoints: ["onboard", "chat", "brief"] });
}

async function chat(req, res) {
  const body = await readJson(req);
  const messages = cleanMessages(body.messages);
  const profile = onboarding.cleanProfile(body.profile);
  const rows = evaluate(body.vitals, profile);
  const lastUser = messages[messages.length - 1].content;

  const alerts = rows.filter((r) => r.zone !== "ok");
  const escalate = rows.some((r) => r.zone === "crit") || RED_FLAGS.test(lastUser);
  const llmMessages = [{ role: "system", content: systemPrompt(profile, rows, cleanContext(body.context)) }, ...messages];
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

/* Critical-stats screen: a short VEGA briefing. Status and escalation are decided in code, the words by Qwen. */
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
      out = {
        headline: r.headline.trim().slice(0, 160),
        notes: Object.fromEntries((r.notes || []).filter((n) => n && typeof n.note === "string").map((n) => [n.id, n.note.trim().slice(0, 120)])),
        actions: (r.actions || []).filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim().slice(0, 160)).slice(0, 4),
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

async function onboardAnswer(req, res) {
  const body = await readJson(req);
  json(res, 200, await onboarding.answer({ chat: (o) => ollama.chat({ ...o, signal: abortOnClose(res) }) }, body));
}

async function onboardFinish(req, res) {
  const body = await readJson(req);
  json(res, 200, await onboarding.finish({ chat: (o) => ollama.chat({ ...o, signal: abortOnClose(res) }) }, body));
}

const ROUTES = {
  "GET /api/ai/status": status,
  "GET /api/ai/onboard/questions": (req, res) => json(res, 200, { questions: onboarding.publicQuestions() }),
  "POST /api/ai/onboard/answer": onboardAnswer,
  "POST /api/ai/onboard/finish": onboardFinish,
  "POST /api/ai/chat": chat,
  "POST /api/ai/brief": brief,
};

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
  const fn = ROUTES[key];
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

module.exports = { handle };
