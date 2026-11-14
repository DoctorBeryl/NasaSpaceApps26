/* ==========================================================
   AstraSight: face sign-in + Firebase Auth (no dependencies)

   The browser runs face-api.js and sends 128-number face
   descriptors (never images). This module matches them against
   enrolled crew, then mints a Firebase *custom token* so the
   browser can call signInWithCustomToken(). Tokens are signed
   with the service-account key using Node's crypto, so we don't
   need the firebase-admin package.

   Without Firebase settings in .env it runs in "local" mode:
   same face matching, and the browser keeps the session itself.

   GET  /api/auth/config         { mode, firebase, faceModels, threshold, enrolled }
   POST /api/auth/face/verify    { descriptors: number[128][] }          -> session | 401
   POST /api/auth/face/enroll    { name, descriptors: number[128][] }    -> session | 409

   session = { uid, name, isNew, mode, token, distance }

   Templates live in server/data/faces.json (gitignored, never
   served). CLI:  node server/auth.js list | remove <uid> | reset
   See docs/AUTH.md.
   ========================================================== */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const FACES_FILE = path.join(DATA_DIR, "faces.json");

const DIM = 128;
const MAX_BODY = 128 * 1024;
const MAX_TEMPLATES_PER_USER = 24;
/* Euclidean distance between face-api descriptors. 0.6 is the library's
   default "same person" cut-off; 0.5 is stricter (fewer false accepts). */
const THRESHOLD = clampNum(Number(process.env.FACE_MATCH_THRESHOLD), 0.3, 0.7, 0.5);
const FACE_MODELS = process.env.FACE_MODEL_URL || "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";
const TOKEN_AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function clampNum(n, lo, hi, dflt) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

/* ---------------- Firebase config (from .env) ---------------- */
function loadServiceAccount() {
  try {
    const file = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (file) {
      const sa = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), "utf8"));
      if (sa.client_email && sa.private_key) return { email: sa.client_email, key: sa.private_key, projectId: sa.project_id };
    }
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      return {
        email: process.env.FIREBASE_CLIENT_EMAIL,
        key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        projectId: process.env.FIREBASE_PROJECT_ID,
      };
    }
  } catch (e) {
    console.error(`[auth] Couldn't read the Firebase service account: ${e.message}`);
  }
  return null;
}

const SA = loadServiceAccount();
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || SA?.projectId || "";
/* The web config is public by design (it ships to every browser), but we keep
   it in .env so each teammate can point at their own Firebase project. */
const WEB_CONFIG = process.env.FIREBASE_API_KEY && PROJECT_ID ? {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID || undefined,
} : null;
const MODE = WEB_CONFIG && SA ? "firebase" : "local";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** Firebase custom token: an RS256 JWT signed by the service account, valid 1 h. */
function customToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: SA.email, sub: SA.email, aud: TOKEN_AUD, iat: now, exp: now + 3600, uid }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${body}`), SA.key);
  return `${head}.${body}.${b64url(sig)}`;
}

/* ---------------- ID token verification (for other API routes) ---------------- */
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certs = { keys: {}, until: 0 };

async function googleCerts() {
  if (Date.now() < certs.until) return certs.keys;
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error(`cert fetch ${r.status}`);
  const maxAge = Number((r.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1]) || 3600;
  certs = { keys: await r.json(), until: Date.now() + maxAge * 1000 };
  return certs.keys;
}

/** Verify a Firebase ID token (RS256, Google certs). Returns { uid, name } or null. */
async function verifyIdToken(token) {
  try {
    const [h, p, s] = String(token).split(".");
    const head = JSON.parse(Buffer.from(h, "base64url"));
    const body = JSON.parse(Buffer.from(p, "base64url"));
    const now = Math.floor(Date.now() / 1000);
    if (head.alg !== "RS256" || body.aud !== PROJECT_ID || body.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (!(body.exp > now) || !(body.iat <= now + 300) || !body.sub) return null;
    const pem = (await googleCerts())[head.kid];
    if (!pem || !crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), pem, Buffer.from(s, "base64url"))) return null;
    return { uid: body.sub, name: body.name || null };
  } catch {
    return null;
  }
}

/**
 * Who's calling? For routes that want a signed-in crew member:
 *   const who = await auth.userFromRequest(req);  // { uid, name } | null
 * Firebase mode: checks "Authorization: Bearer <AstraAuth.getIdToken()>".
 * Local mode: there are no tokens to check, so it always returns null.
 */
async function userFromRequest(req) {
  if (MODE !== "firebase") return null;
  const m = (req.headers.authorization || "").match(/^Bearer\s+(\S+)$/i);
  return m ? verifyIdToken(m[1]) : null;
}

/* ---------------- template store ---------------- */
let db = null, dbMtime = 0;

/* Cached, but re-read if the file changed on disk (e.g. the CLI ran while the server is up). */
function load() {
  let mtime = 0;
  try { mtime = fs.statSync(FACES_FILE).mtimeMs; } catch { /* no file yet */ }
  if (db && mtime === dbMtime) return db;
  dbMtime = mtime;
  try {
    db = JSON.parse(fs.readFileSync(FACES_FILE, "utf8"));
    if (!Array.isArray(db.users)) throw new Error("bad file");
  } catch (e) {
    if (e.code !== "ENOENT") console.error(`[auth] ${FACES_FILE} unreadable (${e.message}); starting empty`);
    db = { version: 1, users: [] };
  }
  return db;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FACES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FACES_FILE);   // atomic on the same volume
  dbMtime = fs.statSync(FACES_FILE).mtimeMs;
}

/* ---------------- matching ---------------- */
function distance(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Score each user by the median (over probes) of the closest stored template. Lower is better. */
function bestMatch(probes) {
  let best = null;
  for (const user of load().users) {
    if (!user.descriptors?.length) continue;
    const score = median(probes.map((p) => Math.min(...user.descriptors.map((t) => distance(p, t)))));
    if (!best || score < best.distance) best = { user, distance: score };
  }
  return best;
}

/* ---------------- input checks ---------------- */
function bad(message, status = 400, code = "bad_request") {
  return Object.assign(new Error(message), { status, code });
}

function cleanDescriptors(list, min, max) {
  if (!Array.isArray(list) || list.length < min) throw bad(`Send at least ${min} face descriptor${min > 1 ? "s" : ""}.`);
  return list.slice(0, max).map((d) => {
    if (!Array.isArray(d) || d.length !== DIM || !d.every((x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 2)) {
      throw bad(`Each descriptor must be ${DIM} numbers.`);
    }
    return d.map((x) => Math.round(x * 1e5) / 1e5);
  });
}

function cleanName(name) {
  const n = String(name || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!n) throw bad("Enter a name or call sign.");
  return n;
}

/* Simple per-IP limiter so nobody can brute-force descriptors. */
const hits = new Map();
function rateLimit(req) {
  const ip = req.socket.remoteAddress || "?";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > 30) throw bad("Too many attempts. Wait a minute and try again.", 429, "rate_limited");
}

/* ---------------- sessions ---------------- */
function session(user, isNew, dist) {
  let token = null;
  if (MODE === "firebase") {
    try {
      token = customToken(user.uid);
    } catch (e) {
      console.error(`[auth] Couldn't sign a custom token: ${e.message}`);
      throw bad("Sign-in service is misconfigured. Check FIREBASE_* in .env.", 500, "token_failed");
    }
  }
  return { uid: user.uid, name: user.name, isNew, mode: MODE, token, distance: dist == null ? null : Math.round(dist * 1000) / 1000 };
}

/* ---------------- handlers ---------------- */
function config() {
  return { mode: MODE, firebase: MODE === "firebase" ? WEB_CONFIG : null, faceModels: FACE_MODELS, threshold: THRESHOLD, enrolled: load().users.length };
}

function verify(body) {
  const probes = cleanDescriptors(body.descriptors, 1, 10);
  const m = bestMatch(probes);
  if (!m || m.distance >= THRESHOLD) {
    // Logged, not returned: a score in the response would help someone tune forged descriptors.
    if (m) console.log(`[auth] No match (closest: ${m.user.name} at ${m.distance.toFixed(3)}, threshold ${THRESHOLD})`);
    throw bad("Face not recognized.", 401, "no_match");
  }
  const u = m.user;
  u.lastLoginAt = new Date().toISOString();
  // Keep templates fresh: add a confident probe so lighting/hair changes are learned over time.
  if (m.distance < THRESHOLD * 0.8) {
    u.descriptors.push(probes[0]);
    if (u.descriptors.length > MAX_TEMPLATES_PER_USER) u.descriptors.splice(u.enrolledCount || 0, 1);
  }
  save();
  return session(u, false, m.distance);
}

function enroll(body) {
  const name = cleanName(body.name);
  const descriptors = cleanDescriptors(body.descriptors, 3, 12);
  const m = bestMatch(descriptors);
  if (m && m.distance < THRESHOLD) {
    throw Object.assign(bad(`This face is already enrolled as ${m.user.name}.`, 409, "already_enrolled"), { extra: { name: m.user.name } });
  }
  const now = new Date().toISOString();
  const user = { uid: `crew_${crypto.randomBytes(9).toString("base64url")}`, name, createdAt: now, lastLoginAt: now, enrolledCount: descriptors.length, descriptors };
  load().users.push(user);
  save();
  console.log(`[auth] Enrolled ${name} (${user.uid}) with ${descriptors.length} templates`);
  return session(user, true, null);
}

/* ---------------- routing ---------------- */
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw bad("Body too large", 413);
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw bad("Bad JSON"); }
}

const ROUTES = {
  "GET /api/auth/config": async () => config(),
  "POST /api/auth/face/verify": async (req) => { rateLimit(req); return verify(await readJson(req)); },
  "POST /api/auth/face/enroll": async (req) => { rateLimit(req); return enroll(await readJson(req)); },
};

/** Returns true if the request was an /api/auth route (handled here). */
function handle(req, res) {
  const url = req.url.split("?")[0];
  if (!url.startsWith("/api/auth/")) return false;
  const fn = ROUTES[`${req.method} ${url}`];
  if (!fn) {
    json(res, 404, { error: "not_found", message: `No route ${req.method} ${url}` });
    return true;
  }
  fn(req, res)
    .then((out) => json(res, 200, out))
    .catch((e) => {
      const status = e.status || 500;
      if (status >= 500) console.error("[auth]", e);
      json(res, status, { error: e.code || "server_error", message: e.message, ...(e.extra || {}) });
    });
  return true;
}

function describe() {
  return MODE === "firebase"
    ? `Face sign-in: Firebase project ${PROJECT_ID}, ${load().users.length} crew enrolled`
    : `Face sign-in: local mode (no Firebase settings in .env), ${load().users.length} crew enrolled`;
}

module.exports = { handle, describe, userFromRequest, verifyIdToken, mode: MODE };

/* ---------------- CLI: node server/auth.js list | remove <uid> | reset ---------------- */
if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  const d = load();
  if (cmd === "list") {
    if (!d.users.length) console.log("No crew enrolled.");
    for (const u of d.users) console.log(`${u.uid}  ${u.name.padEnd(20)}  ${u.descriptors.length} templates  last sign-in ${u.lastLoginAt}`);
  } else if (cmd === "remove" && arg) {
    const before = d.users.length;
    d.users = d.users.filter((u) => u.uid !== arg && u.name !== arg);
    save();
    console.log(before === d.users.length ? `No crew member "${arg}".` : `Removed "${arg}". Their Firestore profile, if any, is untouched.`);
  } else if (cmd === "reset") {
    d.users = [];
    save();
    console.log("Removed all face templates.");
  } else {
    console.log("Usage: node server/auth.js list | remove <uid|name> | reset");
  }
}
