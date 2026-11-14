/* ==========================================================
   AstraSight: thin Ollama client (no dependencies, Node 18+)
   Talks to a local Ollama server running Qwen 2.5 (chat, onboarding,
   brief) and MedGemma (body-map triage, /api/ai/triage).
   Env: OLLAMA_URL, OLLAMA_MODEL, OLLAMA_MED_MODEL, OLLAMA_TIMEOUT_MS, OLLAMA_NUM_CTX
   ========================================================== */
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const MED_MODEL = process.env.OLLAMA_MED_MODEL || "medgemma1.5:4b";   // medical model for triage
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120000;
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 8192;

class OllamaError extends Error {
  constructor(message, { status = 503, code = "ollama_unavailable" } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function body({ model = MODEL, messages, format, temperature, stream }) {
  return JSON.stringify({
    model,
    messages,
    stream,
    ...(format ? { format } : {}),
    keep_alive: "30m",                      // keep the model loaded between requests
    options: { temperature, num_ctx: NUM_CTX },
  });
}

async function post(path, payload, signal, model = MODEL) {
  let r;
  try {
    r = await fetch(`${OLLAMA_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e.name === "TimeoutError") throw new OllamaError(`Ollama timed out after ${TIMEOUT_MS} ms`, { status: 504, code: "ollama_timeout" });
    if (e.name === "AbortError") throw new OllamaError("Request aborted", { status: 499, code: "aborted" });
    throw new OllamaError(`Can't reach Ollama at ${OLLAMA_URL}. Is it running? (${e.cause?.code || e.message})`);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const missing = r.status === 404 && /not found/i.test(text);
    throw new OllamaError(
      missing ? `Model "${model}" isn't pulled. Run: ollama pull ${model}` : `Ollama ${r.status}: ${text.slice(0, 300)}`,
      { status: missing ? 503 : 502, code: missing ? "model_missing" : "ollama_error" },
    );
  }
  return r;
}

/** One-shot chat. Returns the assistant text, or the parsed object when `format` is a JSON schema. */
async function chat({ model = MODEL, messages, format, temperature = 0.4, signal } = {}) {
  const r = await post("/api/chat", body({ model, messages, format, temperature, stream: false }), signal, model);
  const data = await r.json();
  const content = data?.message?.content ?? "";
  if (!format) return content.trim();
  try {
    return JSON.parse(content);
  } catch {
    throw new OllamaError("Model returned invalid JSON", { status: 502, code: "bad_json" });
  }
}

/** Streaming chat. Async generator of text deltas. */
async function* chatStream({ messages, temperature = 0.5, signal } = {}) {
  const r = await post("/api/chat", body({ messages, temperature, stream: true }), signal);
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new OllamaError(`Ollama: ${msg.error}`, { status: 502, code: "ollama_error" });
      if (msg.message?.content) yield msg.message.content;
      if (msg.done) return;
    }
  }
}

/** Is Ollama up, and is the model pulled? Never throws. */
async function status(MODEL = module.exports.MODEL) {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return { reachable: false, model: MODEL, modelReady: false, url: OLLAMA_URL };
    const { models = [] } = await r.json();
    const names = models.map((m) => m.name);
    const want = MODEL.includes(":") ? MODEL : `${MODEL}:latest`;
    return { reachable: true, model: MODEL, modelReady: names.includes(want), url: OLLAMA_URL, installed: names };
  } catch {
    return { reachable: false, model: MODEL, modelReady: false, url: OLLAMA_URL };
  }
}

module.exports = { chat, chatStream, status, OllamaError, MODEL, MED_MODEL, OLLAMA_URL };
