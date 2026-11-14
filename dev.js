/* ==========================================================
   AstraSight: one-command dev launcher (no dependencies, Node 18+)
   Runs the backend pieces side by side with prefixed output:
   - [ollama]  `ollama serve`, only if Ollama isn't already running
               (the Windows/macOS desktop app usually runs it already)
   - [server]  node server.js: static site, face/email sign-in (/api/auth/*),
               VEGA AI (/api/ai/*, /api/chat), voice (/api/tts, /api/stt).
               Face recognition itself runs in the browser (face-api.js);
               the server only matches descriptors, so there's no extra process.
   Ctrl+C stops everything this script started.
   Run: node dev.js   (or: npm run dev)
   ========================================================== */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/* Read OLLAMA_URL from .env the same way server.js does. */
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch { /* no .env */ }
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

const COLORS = { ollama: "\x1b[35m", server: "\x1b[36m", dev: "\x1b[33m" };
const tag = (name) => `${COLORS[name] || ""}[${name}]\x1b[0m `;
const log = (msg) => console.log(tag("dev") + msg);

const children = [];
function run(name, cmd, args, { critical = false } = {}) {
  const child = spawn(cmd, args, { cwd: __dirname, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) out.write(tag(name) + l + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("error", (e) => log(`${name} failed to start: ${e.message}`));
  child.on("exit", (code, sig) => {
    log(`${name} exited (${sig || code})`);
    if (critical && !shuttingDown) shutdown(code || 1);
  });
  children.push(child);
  return child;
}

async function ollamaUp() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

async function waitFor(check, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("stopping...");
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  if (await ollamaUp()) {
    log(`Ollama already running at ${OLLAMA_URL}, using it`);
  } else {
    log("starting Ollama (ollama serve)...");
    const o = run("ollama", "ollama", ["serve"]);
    o.on("error", () => log("Ollama isn't installed or not on PATH: VEGA will answer built-in commands only (https://ollama.com)"));
    if (!(await waitFor(ollamaUp, 10000))) log("Ollama didn't come up within 10 s; starting the server anyway");
  }
  run("server", process.execPath, ["server.js"], { critical: true });
})();
