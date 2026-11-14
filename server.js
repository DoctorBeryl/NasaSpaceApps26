/* ==========================================================
   AstraSight — local dev server (no dependencies, Node 18+)
   - Serves the static site
   - POST /api/tts  { text }  -> audio/mpeg from ElevenLabs
     The API key stays here (read from .env), never in the browser.
   - /api/ai/*  VEGA on Qwen 2.5 via local Ollama (server/ai.js,
     contract in docs/AI-BACKEND.md)
   Run: node server.js
   ========================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

/* ---- tiny .env loader ---- */
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch { /* no .env: TTS falls back to the browser voice */ }

const ai = require("./server/ai");   // after the .env loader, so OLLAMA_* vars apply
const auth = require("./server/auth"); // face sign-in + Firebase custom tokens (docs/AUTH.md)

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
const PORT = Number(process.env.PORT) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

async function tts(req, res) {
  if (!KEY) return send(res, 503, "ELEVENLABS_API_KEY not set");
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 10000) return send(res, 413, "Too long"); }
  let text;
  try { text = String(JSON.parse(raw).text || "").trim().slice(0, 1000); } catch { return send(res, 400, "Bad JSON"); }
  if (!text) return send(res, 400, "No text");

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) {
      const msg = await r.text();
      console.error(`[tts] ElevenLabs ${r.status}: ${msg.slice(0, 300)}`);
      return send(res, 502, "TTS failed");
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": buf.length, "Cache-Control": "no-store" });
    res.end(buf);
  } catch (e) {
    console.error("[tts]", e.message);
    send(res, 502, "TTS failed");
  }
}

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  const base = path.basename(file);
  if (!file.startsWith(ROOT + path.sep) || base.startsWith(".") || base === "server.js" || file.startsWith(path.join(ROOT, "server") + path.sep)) return send(res, 404, "Not found");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (ai.handle(req, res)) return;
  if (auth.handle(req, res)) return;
  if (url === "/api/tts") {
    // Let pages served by another local static server (npx serve, Live Server) use this proxy.
    // Localhost origins only, so other websites can't spend the ElevenLabs key.
    const origin = req.headers.origin || "";
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }
  if (url === "/api/tts" && req.method === "POST") return tts(req, res);
  if (url === "/api/tts" && req.method === "GET") return send(res, KEY ? 200 : 503, JSON.stringify({ enabled: !!KEY }), "application/json");
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  serveStatic(req, res);
}).on("error", (e) => {
  if (e.code !== "EADDRINUSE") throw e;
  console.error(`Port ${PORT} is already in use, probably by another copy of this server.`);
  console.error(`Open http://localhost:${PORT} if that one is AstraSight, stop it first, or run with another port (PowerShell: $env:PORT=8001; node server.js).`);
  process.exit(1);
}).listen(PORT, () => {
  console.log(`AstraSight running at http://localhost:${PORT}`);
  console.log(auth.describe());
  console.log(`VEGA AI: ${process.env.OLLAMA_MODEL || "qwen2.5:3b"} via Ollama (GET /api/ai/status to check)`);
  console.log(KEY ? `ElevenLabs voice enabled (voice ${VOICE}, model ${MODEL})` : "ELEVENLABS_API_KEY not set: using browser voice");
});
