/* ==========================================================
   AstraSight: thin Gemini client (no dependencies, Node 18+)
   Used only for the first-visit questionnaire (/api/ai/onboard/*), which needs quick replies.
   Medical triage stays on MedGemma and chat on Qwen (server/ollama.js).
   Enabled when GEMINI_API_KEY is set (free key: aistudio.google.com → Get API key). Without it,
   or if a call fails, server/ai.js falls back to Ollama, so laptops stay fully on-device.
   Env: GEMINI_API_KEY, GEMINI_MODEL (default gemini-flash-latest), GEMINI_REASONING
        (none/low/medium/high, default low), GEMINI_TIMEOUT_MS (default 30000)
   Uses Google's OpenAI-compatible endpoint, so `chat()` matches ollama.chat(): it returns the
   text, or the parsed object when `format` is a JSON schema.
   ========================================================== */
const KEY = (process.env.GEMINI_API_KEY || "").trim();
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const REASONING = process.env.GEMINI_REASONING || "low";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;
const URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

class GeminiError extends Error {
  constructor(message, { status = 502, code = "gemini_error" } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function chat({ messages, format, temperature = 0.4, signal } = {}) {
  if (!KEY) throw new GeminiError("GEMINI_API_KEY isn't set", { status: 503, code: "gemini_disabled" });
  const payload = { model: MODEL, messages, temperature, reasoning_effort: REASONING };
  if (format) payload.response_format = { type: "json_schema", json_schema: { name: "answer", schema: format } };
  let r;
  try {
    r = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e.name === "TimeoutError") throw new GeminiError(`Gemini timed out after ${TIMEOUT_MS} ms`, { status: 504, code: "gemini_timeout" });
    if (e.name === "AbortError") throw new GeminiError("Request aborted", { status: 499, code: "aborted" });
    throw new GeminiError(`Can't reach Gemini (${e.cause?.code || e.message})`);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new GeminiError(`Gemini ${r.status}: ${text.slice(0, 300)}`, { status: r.status === 429 ? 429 : 502 });
  }
  const data = await r.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!format) return content;
  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new GeminiError("Gemini returned invalid JSON", { code: "bad_json" });
  }
}

module.exports = { chat, GeminiError, MODEL, enabled: !!KEY };
