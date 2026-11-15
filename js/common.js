/* ==========================================================
   AstraSight — shared chrome: nav, footer, starfield, reveal
   ========================================================== */
const BRAND_MARK = `
<svg class="brand-mark" viewBox="0 0 40 40" fill="none">
  <defs><linearGradient id="bm" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#5ef2ff"/><stop offset=".6" stop-color="#8f7cff"/><stop offset="1" stop-color="#ff6ad5"/></linearGradient></defs>
  <rect x="2" y="12" width="15" height="13" rx="6" stroke="url(#bm)" stroke-width="2.2"/>
  <rect x="23" y="12" width="15" height="13" rx="6" stroke="url(#bm)" stroke-width="2.2"/>
  <path d="M17 17.5c1.8-1.6 4.2-1.6 6 0" stroke="url(#bm)" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="30.5" cy="18.5" r="2" fill="#5ef2ff"/>
</svg>`;

const NAV_LINKS = [
  ["index.html", "Home"],
  ["interface.html", "Interface"],
  ["tools.html", "Diagnostics"],
  ["vega.html", "ASTRA AI"],
  ["report.html", "Report"],
  ["imca.html", "IMCA"],
  ["ultrasound.html", "Ultrasound"],
];

function renderChrome() {
  const page = location.pathname.split("/").pop() || "index.html";
  const nav = document.getElementById("site-nav");
  if (nav) {
    nav.className = "nav";
    nav.innerHTML = `
      <div class="container nav-inner">
        <a class="brand" href="index.html">${BRAND_MARK}<span>AstraSight<small>HEALTH OPTICS</small></span></a>
        <button class="nav-toggle" aria-label="Menu"><span></span><span></span><span></span></button>
        <div class="nav-links">
          ${NAV_LINKS.map(([href, label]) => `<a href="${href}" class="${page === href ? "active" : ""}">${label}</a>`).join("")}
        </div>
      </div>`;
    const toggle = nav.querySelector(".nav-toggle");
    const links = nav.querySelector(".nav-links");
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
  const foot = document.getElementById("site-footer");
  if (foot) {
    foot.innerHTML = `
      <div class="container foot-inner">
        <div class="brand">${BRAND_MARK}<span>AstraSight<small>SPACE HEALTH CHALLENGE</small></span></div>
        <div class="mono" style="font-size:12px">Concept prototype · Simulated data · Not a medical device</div>
      </div>`;
  }
}

function starfield() {
  const c = document.getElementById("starfield");
  if (!c) return;
  const ctx = c.getContext("2d");
  let stars = [], w, h, dpr;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr;
    h = c.height = innerHeight * dpr;
    const count = Math.floor((innerWidth * innerHeight) / 4200);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.3 + 0.2) * dpr,
      s: Math.random() * 0.25 + 0.03,
      t: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 190 : 260) : 0,
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.t += 0.02;
      if (!reduce) { s.y += s.s * dpr; if (s.y > h) { s.y = 0; s.x = Math.random() * w; } }
      const a = 0.45 + Math.sin(s.t) * 0.35;
      ctx.fillStyle = s.hue ? `hsla(${s.hue},100%,80%,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  resize(); addEventListener("resize", resize); frame();
}

function reveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}

/* Tiny sparkline helper used on several pages */
function drawSpark(canvas, data, color = "#5ef2ff") {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, color + "55"); g.addColorStop(1, color + "00");
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke();
}

document.addEventListener("DOMContentLoaded", () => { renderChrome(); starfield(); reveal(); });

/* ==========================================================
   TriageWatch: ASTRA's MedGemma review keeps running after you
   leave the report screen. report.html starts a server job
   (POST /api/ai/triage/jobs) and stores it here; every other page
   polls it and shows a notification when it's ready (in the page,
   plus a system notification if the tab is in the background).
   No notification on report.html itself: the result shows there.
   ========================================================== */
const TriageWatch = (() => {
  const KEY = "astrasight.triageJobs";
  const MAX_AGE = 2 * 3600 * 1000;   // same as the server's job lifetime
  const onReport = /report\.html$/.test(location.pathname);
  const api = (p) => (window.AstraAuth && AstraAuth.api ? AstraAuth.api(p) : p);

  function list() {
    try {
      const l = JSON.parse(localStorage.getItem(KEY)) || [];
      return l.filter((j) => j && j.id && Date.now() - j.at < MAX_AGE);
    } catch { return []; }
  }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(-10))); } catch { /* private mode */ } }
  /** entry: { id, pid, who, at, view, rule? } — replaces any earlier job for the same crew record */
  function add(entry) { save([...list().filter((j) => j.pid !== entry.pid), { status: "running", notified: false, ...entry }]); }
  function update(id, patch) { save(list().map((j) => (j.id === id ? { ...j, ...patch } : j))); }
  function remove(id) { save(list().filter((j) => j.id !== id)); }

  async function headers() {
    const h = {};
    if (window.AstraAuth && AstraAuth.getIdToken) { const t = await AstraAuth.getIdToken().catch(() => null); if (t) h.Authorization = "Bearer " + t; }
    return h;
  }
  /** One status check. Stores the outcome; returns the server's { status, result, message }. */
  async function check(id) {
    if (window.AstraAuth) await AstraAuth.ready.catch(() => null);
    const r = await fetch(api(`/api/ai/triage/jobs/${encodeURIComponent(id)}`), { headers: await headers(), cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404) j.status = "error";
    if (j.status === "done") update(id, { status: "done", result: j.result });
    else if (j.status === "error") update(id, { status: "error", message: j.message || "The review didn't finish." });
    return j;
  }
  /** Poll until the job is done (resolves with the result) or failed (rejects). */
  function wait(id, signal, every = 4000) {
    return new Promise((resolve, reject) => {
      let t = 0;
      const stop = () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); };
      if (signal) signal.addEventListener("abort", stop, { once: true });
      const tick = async () => {
        if (signal && signal.aborted) return;
        try {
          const j = await check(id);
          if (j.status === "done") return resolve(j.result);
          if (j.status === "error") return reject(new Error(j.message || "The review didn't finish"));
        } catch { /* network blip: try again */ }
        t = setTimeout(tick, every);
      };
      tick();
    });
  }
  /** Ask for system notifications. Call from a click (report.html's review button). */
  function askPermission() {
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* ignore */ }
  }

  function notify(job) {
    update(job.id, { notified: true });
    const ok = job.status === "done";
    const href = `report.html${job.view ? `?${job.view}` : ""}`;
    const title = ok ? "ASTRA's medical review is ready" : "ASTRA's medical review didn't finish";
    const body = ok
      ? `${job.who ? `Report for ${job.who}` : "Your report"}: ${(job.result && job.result.summary) || "open the report screen to read it."}${job.result && job.result.escalate ? " Flight surgeon review advised." : ""}`
      : `${job.message || "Try the review again"} (${job.who || "your report"}).`;
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try { const n = new Notification(title, { body, tag: `triage-${job.id}` }); n.onclick = () => { window.focus(); location.href = href; }; } catch { /* ignore */ }
    }
    if (!document.getElementById("triage-toast-css")) {
      const css = document.createElement("style");
      css.id = "triage-toast-css";
      css.textContent = `.triage-toast{position:fixed;left:16px;bottom:16px;z-index:9999;max-width:min(380px,calc(100vw - 32px));padding:14px 16px;border-radius:12px;
        background:#07111d;border:1px solid rgba(0,240,255,.45);box-shadow:0 10px 40px rgba(0,0,0,.55),0 0 24px rgba(0,240,255,.15);color:#d8e8f4;
        font:14px/1.45 Inter,system-ui,sans-serif;animation:ttIn .25s ease-out}
        .triage-toast.warn{border-color:rgba(255,42,75,.6)}
        .triage-toast b{display:block;font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#00f0ff;margin-bottom:4px}
        .triage-toast.warn b{color:#ff6b81}
        .triage-toast p{margin:0 0 10px;color:#a9c2d4;font-size:13px}
        .triage-toast .tt-row{display:flex;gap:8px;justify-content:flex-end}
        .triage-toast a,.triage-toast button{font:600 12px/1 "JetBrains Mono",monospace;padding:8px 12px;border-radius:8px;cursor:pointer;text-decoration:none}
        .triage-toast a{background:#00f0ff;color:#04060d}
        .triage-toast button{background:transparent;color:#a9c2d4;border:1px solid rgba(169,194,212,.35)}
        @keyframes ttIn{from{transform:translateY(12px);opacity:0}}
        @media (prefers-reduced-motion:reduce){.triage-toast{animation:none}}`;
      document.head.appendChild(css);
    }
    const el = document.createElement("div");
    el.className = `triage-toast${ok && !(job.result && job.result.escalate) ? "" : " warn"}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<b></b><p></p><div class="tt-row"><button type="button">Dismiss</button><a>Open report</a></div>`;
    el.querySelector("b").textContent = title;
    el.querySelector("p").textContent = body;
    el.querySelector("a").href = href;
    el.querySelector("button").onclick = () => el.remove();
    document.body.appendChild(el);
  }

  /* Other pages: poll pending jobs and notify once per job (across tabs). */
  if (!onReport) {
    let looping = false;
    const loop = async () => {
      looping = true;
      for (const job of list()) {
        if (job.notified) continue;
        let j = job;
        if (job.status === "running") { try { await check(job.id); } catch { continue; } j = list().find((x) => x.id === job.id); }
        if (j && j.status !== "running" && !j.notified) notify(j);
      }
      if (list().some((j) => !j.notified)) setTimeout(loop, 5000); else looping = false;
    };
    const kick = () => { if (!looping && list().some((j) => !j.notified)) { looping = true; setTimeout(loop, 1500); } };
    document.addEventListener("DOMContentLoaded", kick);
    window.addEventListener("storage", (e) => { if (e.key === KEY) kick(); });
  }

  return { list, add, update, remove, check, wait, askPermission, onReport };
})();
