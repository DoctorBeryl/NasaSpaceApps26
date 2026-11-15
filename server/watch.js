/* ==========================================================
   AstraSight — live readings from a Garmin watch (Connect IQ app in garmin/AstraLink)
   POST /api/watch          { code, hr, hrv, spo2, resp, stress, bodyBattery, steps, device }
                            The watch posts every few seconds through the phone's Garmin Connect app.
   GET  /api/watch/<code>   -> { connected, ageMs, data }  for the web page (js/watch.js)
   The 6-character pair code is shown on the watch; the page asks for it once. Readings live
   in memory only, expire after 10 minutes, and are never written to disk.
   ========================================================== */
const auth = require("./auth");

const CODE = /^[A-Z0-9]{6}$/;
const TTL = 10 * 60_000;
const MAX_CODES = 200;
const store = new Map(); // code -> { at, data }

/* Field -> [min, max]. Anything outside physical range is dropped, not clamped. */
const FIELDS = {
  hr: [25, 250], hrv: [1, 300], spo2: [50, 100], resp: [2, 70], stress: [0, 100],
  bodyBattery: [0, 100], steps: [0, 200000], battery: [0, 100],
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function prune() {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.at > TTL) store.delete(k);
  while (store.size > MAX_CODES) store.delete(store.keys().next().value); // oldest first
}

function clean(body) {
  const data = {};
  for (const [k, [lo, hi]] of Object.entries(FIELDS)) {
    const v = Number(body[k]);
    if (body[k] != null && Number.isFinite(v) && v >= lo && v <= hi) data[k] = Math.round(v * 10) / 10;
  }
  if (typeof body.device === "string") data.device = body.device.replace(/[^\w .\-]/g, "").slice(0, 40);
  return data;
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function post(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req) || "{}"); } catch { return json(res, 400, { error: "bad_json" }); }
  const code = String(body.code || "").toUpperCase();
  if (!CODE.test(code)) return json(res, 400, { error: "bad_code" });
  // One post every 3 s is 20/min; leave room for retries, stop floods.
  if (!auth.allow(`watch:${code}`, 60) || !auth.allow(`watchip:${auth.clientIp(req)}`, 120)) return json(res, 429, { error: "rate_limited" });
  const data = clean(body);
  if (data.hr == null && data.spo2 == null && data.hrv == null) return json(res, 400, { error: "no_readings" });
  store.delete(code); // re-insert so Map order stays "least recently updated first"
  store.set(code, { at: Date.now(), data });
  prune();
  json(res, 200, { ok: true });
}

function get(res, code) {
  prune();
  const hit = store.get(code);
  if (!hit) return json(res, 200, { connected: false });
  json(res, 200, { connected: true, ageMs: Date.now() - hit.at, data: hit.data });
}

/* Returns true when it handled the request. */
function handle(req, res) {
  const url = req.url.split("?")[0];
  if (url === "/api/watch" && req.method === "POST") { post(req, res); return true; }
  const m = url.match(/^\/api\/watch\/([A-Za-z0-9]{6})$/);
  if (m && req.method === "GET") { get(res, m[1].toUpperCase()); return true; }
  return false;
}

module.exports = { handle };
