# VEGA AI backend (Qwen 2.5 via Ollama)

The contract between the AI backend and the frontend features built on it: the onboarding questionnaire, the chat sidebar, and the critical-stats screen. The backend lives in `server/` and is mounted by `server.js` under `/api/ai/*`.

## Run it

1. Install [Ollama](https://ollama.com/download), then pull the model:
   ```sh
   ollama pull qwen2.5:3b      # ~1.9 GB, runs on most laptops
   # better answers, slower on CPU: ollama pull qwen2.5:7b and set OLLAMA_MODEL=qwen2.5:7b
   ```
2. Start the site: `node server.js` (Node 18 or later), then open http://localhost:8000.
3. Check that it works: `curl localhost:8000/api/ai/status` should return `"reachable": true, "modelReady": true`.

Optional `.env` settings (see `.env.example`): `OLLAMA_URL` (default `http://127.0.0.1:11434`), `OLLAMA_MODEL` (default `qwen2.5:3b`), `OLLAMA_TIMEOUT_MS` (120000), `OLLAMA_NUM_CTX` (8192).

**Without Ollama:** onboarding and the brief still work, using rule-based fallbacks (`"source": "rules"`). Chat returns `503 {"error":"ollama_unavailable"}`, so show a "VEGA is offline" state.

## Design

- **Stateless.** The server stores nothing. The client keeps the crew **profile** (for example in Firestore under the user's uid) and sends it with every request.
- **Safety in code, not just the prompt.** Zones come from `js/data.js` (`zoneOf`), never from the model. A reading in the danger zone, or a red-flag phrase such as "chest pain", sets `escalate: true`, and the server appends a flight-surgeon line if the model left it out.
- **Personal thresholds** are clamped server-side on every request. A caution line can move at most halfway toward its danger line. Danger lines never move. Anything VEGA proposes is marked `"status": "proposed"` until a flight surgeon signs off.
- **Persona:** edit [server/persona.md](../server/persona.md). The server reads it on each request, and HTML comments in it are stripped before it reaches the model.

## Sign-in

In Firebase mode (see [AUTH.md](AUTH.md)), every route except `/status` and `/onboard/questions` needs the crew member's ID token, or it returns `401 {"error":"unauthorized"}`:
```js
const token = await AstraAuth.getIdToken();   // null in local mode
fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: ... });
```
In local mode the routes are open. `AI_REQUIRE_AUTH=0` in `.env` turns the check off in Firebase mode too, for demos.

## Endpoints

All bodies are JSON. Errors look like `{ "error": "<code>", "message": "..." }`, with codes `bad_request` (400), `unauthorized` (401), `not_found` (404), `ollama_unavailable` / `model_missing` (503), `ollama_timeout` (504), and `ollama_error` / `bad_json` (502).

### `GET /api/ai/status`
```json
{ "reachable": true, "model": "qwen2.5:3b", "modelReady": true, "url": "http://127.0.0.1:11434", "installed": ["qwen2.5:3b"], "endpoints": ["onboard","chat","brief"] }
```

### `GET /api/ai/onboard/questions`
Returns `{ questions: [...] }`, the fixed questionnaire in order. Each question:
```json
{ "id": "fitness", "topic": "Baselines", "kind": "text", "text": "Tell me about your usual exercise...", "placeholder": "e.g. I run most days, resting HR about 52", "optional": false }
```
- `kind: "text"`: free text. Qwen extracts structured fields from it.
- `kind: "choice"`: send one `options[].value`.
- `kind: "multi"`: send an array of `options[].value` (`focus` allows up to 4).
- `optional: true`: an empty answer is allowed (skip).

### `POST /api/ai/onboard/answer`
Request: `{ "questionId": "fitness", "answer": "I run daily, resting HR about 46", "profile": { ...current profile, or {} at the start } }`

Response:
```json
{
  "patch":   { "exerciseLevel": "athlete", "restingHr": 46 },
  "profile": { ...merged, cleaned profile: store this },
  "ack":     "Great, a runner's heart. Noted.",
  "followUp": null,
  "source":  "model"
}
```
If `followUp` isn't null, it's a one-off clarifying question (`{ id: "fitness.followup", kind: "text", text }`). Ask it next, and send the reply with that `id` as `questionId`. Follow-ups never chain. Show `ack` as VEGA's reply bubble.

### `POST /api/ai/onboard/finish`
Request: `{ "profile": {...} }`. Response: `{ "profile": {...with "tailoring"} }`. Save it; the tutorial and HUD read from `tailoring`:
```json
"tailoring": {
  "summary": "Flight engineer on a 180-day ISS mission. Endurance runner with resting HR 46 bpm...",
  "welcome": "You're all set, Nova. I'll keep an eye on your heart rate and sleep.",
  "focusTools": ["cardio", "hrv", "cog", "spo2"],
  "thresholds": { "cardio": { "warnLo": 45, "warnHi": 110, "reason": "...", "source": "baseline-rule", "status": "proposed" } },
  "watchItems": [ { "tool": "general", "note": "History of space motion sickness: expect symptoms in the first days." } ],
  "flightSurgeonNotes": [ "Confirm the personal low heart-rate line of 45 bpm." ],
  "source": "model",
  "generatedAt": "2026-11-14T15:00:00.000Z"
}
```

### `POST /api/ai/chat` (sidebar chat)
Request:
```json
{
  "messages": [ { "role": "user", "content": "How's my oxygen?" } ],
  "profile": { ... },
  "vitals":  { "cardio": 74, "spo2": 96.8, "resp": 15, "neuro": 4.2, "cog": 38, "thermal": 36.8, "rad": 0.6, "hrv": 55 },
  "stream":  true
}
```
- `messages`: the running conversation with roles `user` and `assistant`, ending with `user`. The server keeps the last 16 turns.
- `vitals`: current readings keyed by `TOOLS[].id`. Send whatever the HUD shows right now. Unknown keys are ignored.
- `context` (optional, also accepted by `/brief`): up to 20 labelled values that aren't `TOOLS` indicators, such as EVA telemetry from `report.html`: `{ "Suit pressure": "4.3 PSI", "Primary O2": "62 %", "DCS R-value": 1.21 }`. The model sees them as facts, but they don't trigger `escalate`. Anything that must escalate belongs in `vitals`, or the page handles it.

Without streaming, the response is `{ reply, escalate, alerts, model }`. `alerts` lists the readings outside their normal band, worst first, with `zone`, `side`, `title`, `normal`, `steps`, and `danger`.

With `stream: true`, the response is `application/x-ndjson`, one JSON object per line:
```
{"type":"meta","escalate":false,"alerts":[],"model":"qwen2.5:3b"}
{"type":"delta","text":"Your oxygen is "}
{"type":"delta","text":"96.8%, right in your normal range."}
{"type":"done","reply":"Your oxygen is 96.8%, right in your normal range."}
```
A model failure partway through the stream ends it with `{"type":"error",...}`. If Ollama is down from the start, you get a plain 503 instead of a stream.

Client sketch:
```js
const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages, profile, vitals, stream: true }) });
if (!r.ok) return showOffline(await r.json());
const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
let buf = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += value;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const ev = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (ev.type === "meta" && ev.escalate) showEscalationBanner(ev.alerts);
    if (ev.type === "delta") appendToBubble(ev.text);
  }
}
```
Closing the request (for example with `AbortController`) stops generation on the server.

### `POST /api/ai/brief` (critical-stats screen)
Request: `{ "vitals": {...}, "profile": {...} }`. Response:
```json
{
  "status": "crit", "escalate": true,
  "headline": "Blood oxygen is dangerously low. Act now.",
  "readings": [ { "id": "spo2", "name": "Blood Oxygen", "short": "SpO₂", "unit": "%", "value": 86, "zone": "crit", "side": "low",
                  "normal": "> 94.0 %", "title": "Blood oxygen low", "danger": "Below 90%: ...", "note": "Well below your normal; hypoxia risk." } ],
  "actions": [ "This needs the flight surgeon...", "Put on the emergency oxygen mask." ],
  "source": "model", "model": "qwen2.5:3b", "generatedAt": "..."
}
```
`readings` is sorted worst first. `status` and `escalate` are always computed in code. This takes 2–10 s on Qwen, so call it when the screen opens or on a refresh button, not on every vitals tick.

## Profile fields

`callsign`, `role`, `missionType` (`leo|lunar|mars-transit|mars-surface|analog|other`), `durationDays`, `exerciseLevel` (`low|moderate|high|athlete`), `restingHr`, `sleepHours`, `sleepAids`, `conditions[]`, `medications[]`, `allergies[]`, `history[]`, `copingPrefs[]`, `wantsCheckIns`, `verbosity` (`brief|standard|detailed`), `alertMode` (`voice-and-visual|visual|quiet-on-task`), `focusTools[]`, `answers{}` (raw answers by question id), and `tailoring{}`. The server drops unknown fields and out-of-range values.

## Not done yet (open for other agents)

- The questionnaire, tutorial, chat sidebar, and critical-stats UIs. Store the profile with `AstraAuth.saveProfile` (see [AUTH.md](AUTH.md)).
- **Wire `report.html`'s triage chat to `/api/ai/chat`**, sending its EVA telemetry as `context`. It currently uses keyword rules that name a diagnosis ("PROBABLE TYPE II DCS"), which conflicts with VEGA's "flag, never diagnose" rule.
- **Persona:** `server/persona.md` follows the Gemini prototype's companion (the 16-bit pixel EVA buddy, now VEGA), with the calmer wording the team chose in `js/companion.js`.
