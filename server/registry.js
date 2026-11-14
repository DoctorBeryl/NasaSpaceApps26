/* ==========================================================
   AstraSight: load the tool registry from js/data.js
   js/data.js stays the single source of truth for indicators,
   limits and guidance. We evaluate it in a sandbox so the
   browser and the server always agree on zones.
   ========================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_FILE = path.join(__dirname, "..", "js", "data.js");
const code = fs.readFileSync(DATA_FILE, "utf8");
const { TOOLS, zoneOf } = vm.runInContext(`${code}\n;({ TOOLS, zoneOf });`, vm.createContext({}), { filename: "js/data.js" });

const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const TOOL_IDS = TOOLS.map((t) => t.id);

const fin = (n) => Number.isFinite(n);
const fmt = (t, v) => Number(v).toFixed(t.decimals);

/** The tool with the crew member's personal warn band (if any) applied. Crit limits never change. */
function personalTool(id, profile) {
  const t = byId[id];
  const p = profile?.tailoring?.thresholds?.[id];
  if (!p) return t;
  return { ...t, warnLo: fin(p.warnLo) ? p.warnLo : t.warnLo, warnHi: fin(p.warnHi) ? p.warnHi : t.warnHi };
}

/** Normal band as display text, e.g. "50–110 bpm", "< 70 /100", "> 25 ms". */
function bandText(t) {
  const lo = fin(t.warnLo) && t.warnLo > t.min ? t.warnLo : null;
  const hi = fin(t.warnHi) && t.warnHi < t.max ? t.warnHi : null;
  const u = t.unit.startsWith("/") ? t.unit : ` ${t.unit}`;
  if (lo !== null && hi !== null) return `${fmt(t, lo)}–${fmt(t, hi)}${u}`;
  if (hi !== null) return `< ${fmt(t, hi)}${u}`;
  if (lo !== null) return `> ${fmt(t, lo)}${u}`;
  return "n/a";
}

/**
 * Turn raw readings { cardio: 72, spo2: 97.4, ... } into evaluated rows.
 * Unknown ids and non-numbers are dropped.
 */
function evaluate(vitals = {}, profile) {
  const rows = [];
  for (const [id, raw] of Object.entries(vitals || {})) {
    const value = Number(raw);
    if (!byId[id] || !fin(value)) continue;
    const t = personalTool(id, profile);
    const { zone, side } = zoneOf(t, value);
    const g = side ? t.guidance?.[side] : null;
    rows.push({
      id, name: t.name, short: t.short, unit: t.unit,
      value: Number(fmt(t, value)), zone, side,
      normal: bandText(t),
      title: g?.title || null,
      steps: zone !== "ok" && g ? g.steps : [],
      danger: zone === "crit" && g ? g.danger : null,
    });
  }
  const rank = { crit: 0, warn: 1, ok: 2 };
  return rows.sort((a, b) => rank[a.zone] - rank[b.zone]);
}

function worstZone(rows) {
  return rows.some((r) => r.zone === "crit") ? "crit" : rows.some((r) => r.zone === "warn") ? "warn" : "ok";
}

module.exports = { TOOLS, TOOL_IDS, byId, evaluate, worstZone, personalTool, bandText, fmt };
