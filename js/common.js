/* ==========================================================
   AstraSight — shared chrome: nav, footer, starfield, reveal
   ========================================================== */
const BRAND_MARK = `
<svg class="brand-mark" viewBox="0 0 40 40" fill="none">
  <defs><linearGradient id="bm" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#5ef2ff"/><stop offset=".6" stop-color="#8f7cff"/><stop offset="1" stop-color="#ff6ad5"/></linearGradient></defs>
  <path d="M8 31.5a15 15 0 1 1 24 0" stroke="url(#bm)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M7 32.5h26" stroke="url(#bm)" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="10" y="12" width="20" height="13" rx="6" stroke="url(#bm)" stroke-width="2.2"/>
  <circle cx="15" cy="18.5" r="2" fill="#5ef2ff"/>
</svg>`;

const NAV_LINKS = [
  ["index.html", "Home"],
  ["interface.html", "Interface"],
  ["tools.html", "Diagnostics"],
  ["report.html", "Report"],
  ["ultrasound.html", "Ultrasound"],
  // External: AstroKinetic-ID, the team's companion smart-handrail studio (opens in a new tab)
  ["https://shrill-hill-970c.m9aria9.workers.dev/", "Handrails ↗", "external"],
];
// vega.html (ASTRA AI) is reached through the nav "?" (AstraHelp below). imca.html is no longer in the nav; the page still exists.

function renderChrome() {
  const page = location.pathname.split("/").pop() || "index.html";
  const nav = document.getElementById("site-nav");
  if (nav) {
    nav.className = "nav";
    nav.innerHTML = `
      <div class="container nav-inner">
        <a class="brand" href="index.html">${BRAND_MARK}<span>AstraSight<small>HELMET HEALTH HUD</small></span></a>
        <button class="nav-toggle" aria-label="Menu"><span></span><span></span><span></span></button>
        <div class="nav-links">
          ${NAV_LINKS.map(([href, label, ext]) => ext
            ? `<a href="${href}" target="_blank" rel="noopener" title="AstroKinetic-ID: smart handrail sensor studio (opens in a new tab)">${label}</a>`
            : `<a href="${href}" class="${page === href ? "active" : ""}">${label}</a>`).join("")}
        </div>
        <button type="button" class="nav-help" aria-label="What is ASTRA? Open the ASTRA guide" aria-haspopup="dialog" aria-expanded="false" title="ASTRA: what it is and what you can say">?</button>
      </div>`;
    const toggle = nav.querySelector(".nav-toggle");
    const links = nav.querySelector(".nav-links");
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    nav.querySelector(".nav-help").addEventListener("click", () => AstraHelp.toggle());
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

/* ---------- ASTRA guide: the nav "?" (replaces the old "ASTRA AI" nav link) ----------
   A panel with the essentials of vega.html: who ASTRA is, how a command flows,
   a "try a command" box (VEGA.parse, when vega.js is on the page), what you can say,
   and the ground rules. Styles are injected here so it also works on report.html,
   which doesn't load styles.css. Open from code with AstraHelp.open(). */
const AstraHelp = (() => {
  const PIPE = [
    ["Wake word", "Listens for “ASTRA” using very little power.", "~20 ms"],
    ["Speech → text", "Picks up speech through the bone-conduction mic, even with cabin noise.", "~120 ms"],
    ["Intent model", "Works out what you want and which tool you mean.", "~40 ms"],
    ["Tool router", "Sends the request to the right diagnostic tool or display action.", "~10 ms"],
    ["Clinical reasoning", "Compares the reading with your baseline, habitat telemetry and space-medicine protocols.", "~90 ms"],
    ["Response", "Updates the side panel and speaks a short answer.", "~100 ms"],
  ];
  const SAY = [
    ["“Show my heart rate” · “What's my oxygen?”", "Highlights that tool and reads the value aloud"],
    ["“Run a neuro scan” · “Start a breathing check”", "Runs a scan on one tool and reports the result"],
    ["“Run a full scan” · “Scan me”", "Runs every tool in turn, then gives a summary"],
    ["“Status report” · “How am I doing?”", "Reads out the readiness score and any flags"],
    ["“Hide panel” · “Show panel”", "Hides or shows the side panel"],
    ["“Move panel left” · “Dock right”", "Moves the panel to the other side"],
    ["“Show command log” · “Back to vitals”", "Switches the panel tab"],
    ["“Breathing exercise” · “Help me relax”", "Runs a guided paced-breathing exercise"],
    ["“Simulate emergency” · “Acknowledge”", "Starts or dismisses a test priority alert"],
    ["“Be quiet” · “Voice on”", "Turns spoken replies off or on"],
    ["“Help” · “What can you do?”", "Lists the available commands"],
  ];
  const RULES = [
    ["Works offline", "Mars missions can face comm delays of more than 20 minutes. ASTRA never needs a ground link to understand or answer."],
    ["Personal baselines", "Each reading is judged against your own history, not population averages."],
    ["Clear view first", "Answers are short and spoken. Only critical alerts reach the centre of view."],
    ["Knows its limits", "ASTRA flags and suggests but never diagnoses. Anything serious goes to the flight surgeon with the data."],
    ["Hands-free", "Everything works by voice, in gloves or during an EVA."],
    ["Calm tone", "Even warnings come in a steady voice, with one clear action first."],
  ];
  const EXAMPLES = ["show my heart rate", "run a neuro scan", "I feel tired", "move the panel left", "help me relax"];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let el = null, lastFocus = null;

  function css() {
    if (document.getElementById("astra-help-css")) return;
    const st = document.createElement("style");
    st.id = "astra-help-css";
    st.textContent = `
      .nav-help { flex: none; width: 34px; height: 34px; margin-left: 10px; padding: 0; display: grid; place-items: center; cursor: pointer;
        border-radius: 50%; border: 1.5px solid var(--cyan, #00f0ff); background: transparent; color: var(--cyan, #00f0ff);
        font: 700 16px/1 var(--mono, "JetBrains Mono", monospace); box-shadow: 0 0 12px rgba(0, 240, 255, .25); transition: background .15s, color .15s; }
      .nav-help:hover, .nav-help[aria-expanded="true"] { background: var(--cyan, #00f0ff); color: #001217; }
      .nav-help:focus-visible { outline: 2px solid var(--text, #d8e8f4); outline-offset: 3px; }
      .nav-inner > .nav-links { margin-left: auto; }
      @media (max-width: 760px) { .nav-help { margin-left: auto; margin-right: 10px; } .nav-inner > .nav-toggle { order: 3; } }
      .astra-help { position: fixed; z-index: 90; top: 76px; right: 16px; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 92px);
        display: flex; flex-direction: column; color: var(--text, #d8e8f4); font-family: var(--font, Inter, system-ui, sans-serif); text-align: left;
        background: rgba(5, 10, 20, .97); border: 1px solid rgba(0, 240, 255, .45); border-radius: 12px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, .55), 0 0 28px rgba(0, 240, 255, .15); }
      .astra-help[hidden], .astra-help [hidden] { display: none; }
      .ah-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid rgba(63, 103, 130, .38); }
      .ah-head h2 { margin: 0; font: 400 14px/1.3 var(--pixel, "Press Start 2P", monospace); color: var(--cyan, #00f0ff); letter-spacing: .06em; }
      .ah-head p { margin: 6px 0 0; font-size: 12px; color: var(--text-dim, #8fb0c4); }
      .ah-x { margin-left: auto; flex: none; background: none; border: 0; color: var(--text-faint, #6e8da3); font-size: 15px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
      .ah-x:hover, .ah-x:focus-visible { color: var(--text, #d8e8f4); background: rgba(255, 255, 255, .06); }
      .ah-body { overflow-y: auto; padding: 4px 18px 16px; font-size: 13.5px; line-height: 1.55; }
      .ah-body h3 { margin: 16px 0 8px; font: 600 10.5px/1 var(--mono, "JetBrains Mono", monospace); letter-spacing: .14em; text-transform: uppercase; color: var(--cyan, #00f0ff); }
      .ah-body p { margin: 0; color: var(--text-dim, #8fb0c4); }
      .ah-body p b { color: var(--text, #d8e8f4); font-weight: 600; }
      .ah-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
      .ah-stats div { padding: 8px 10px; border: 1px solid rgba(63, 103, 130, .38); border-radius: 8px; }
      .ah-stats strong { display: block; font: 600 13px var(--mono, "JetBrains Mono", monospace); color: var(--text, #d8e8f4); }
      .ah-stats span { font-size: 11px; color: var(--text-faint, #6e8da3); }
      .ah-pipe { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; counter-reset: ah; }
      .ah-pipe li { counter-increment: ah; display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; align-items: baseline; color: var(--text-dim, #8fb0c4); }
      .ah-pipe li::before { content: counter(ah, decimal-leading-zero); font: 600 11px var(--mono, "JetBrains Mono", monospace); color: var(--cyan, #00f0ff); }
      .ah-pipe b { color: var(--text, #d8e8f4); font-weight: 600; }
      .ah-pipe em { font: normal 11px var(--mono, "JetBrains Mono", monospace); color: var(--text-faint, #6e8da3); white-space: nowrap; }
      .ah-try form { display: flex; gap: 6px; margin: 0; }
      .ah-try input { flex: 1; min-width: 0; font: inherit; font-size: 13px; color: var(--text, #d8e8f4); background: rgba(255, 255, 255, .04);
        border: 1px solid rgba(63, 103, 130, .5); border-radius: 8px; padding: 8px 10px; }
      .ah-try input:focus { outline: none; border-color: var(--cyan, #00f0ff); }
      .ah-try button[type="submit"] { font: 600 11px var(--mono, "JetBrains Mono", monospace); letter-spacing: .08em; text-transform: uppercase; cursor: pointer;
        color: #001217; background: var(--cyan, #00f0ff); border: 0; border-radius: 8px; padding: 0 14px; }
      .ah-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .ah-chips button { font: 11.5px var(--mono, "JetBrains Mono", monospace); cursor: pointer; color: var(--text-dim, #8fb0c4); background: none;
        border: 1px solid rgba(63, 103, 130, .5); border-radius: 999px; padding: 4px 10px; }
      .ah-chips button:hover { color: var(--text, #d8e8f4); border-color: var(--cyan, #00f0ff); }
      .ah-out { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(0, 240, 255, .06); border: 1px solid rgba(0, 240, 255, .2);
        font: 12px/1.5 var(--mono, "JetBrains Mono", monospace); color: var(--text, #d8e8f4); }
      .ah-out span { color: var(--text-faint, #6e8da3); }
      .ah-say, .ah-rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
      .ah-say li { display: grid; gap: 1px; }
      .ah-say q { quotes: none; color: var(--text, #d8e8f4); }
      .ah-say span { font-size: 12.5px; color: var(--text-faint, #6e8da3); }
      .ah-rules { color: var(--text-dim, #8fb0c4); }
      .ah-rules b { color: var(--text, #d8e8f4); font-weight: 600; }
      .ah-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 18px;
        border-top: 1px solid rgba(63, 103, 130, .38); font: 10.5px var(--mono, "JetBrains Mono", monospace); color: var(--text-faint, #6e8da3); }
      .ah-foot a { font: 600 13px var(--font, Inter, system-ui, sans-serif); color: var(--cyan, #00f0ff); text-decoration: none; }
      .ah-foot a:hover { text-decoration: underline; }
      @media (max-width: 520px) { .astra-help { top: 72px; right: 12px; width: calc(100vw - 24px); max-height: calc(100vh - 84px); } }`;
    document.head.appendChild(st);
  }

  function build() {
    el = document.createElement("div");   // not <section>: pages give sections big padding
    el.className = "astra-help";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "ASTRA guide");
    el.innerHTML = `
      <div class="ah-head">
        <div><h2>ASTRA</h2><p>Astronaut Support, Triage &amp; Response Assistant</p></div>
        <button type="button" class="ah-x" aria-label="Close the ASTRA guide">✕</button>
      </div>
      <div class="ah-body">
        <p style="margin-top:12px">ASTRA is a small, specialised language model built for one job: <b>understanding what a crew member says about their health and acting on it right away.</b> It runs on the device, works with no link to Earth, and was tuned on space-medicine protocols.</p>
        <div class="ah-stats">
          <div><strong>On-device</strong><span>No ground link</span></div>
          <div><strong>16</strong><span>Intents</span></div>
          <div><strong>~380 ms</strong><span>Round trip</span></div>
        </div>
        <h3>From voice to vitals</h3>
        <ol class="ah-pipe">${PIPE.map(([k, t, ms]) => `<li><span><b>${k}.</b> ${t}</span><em>${ms}</em></li>`).join("")}</ol>
        <div class="ah-try">
          <h3>Try a command</h3>
          <form autocomplete="off"><input type="text" placeholder="e.g. ASTRA, how's my oxygen?" aria-label="Type a command for ASTRA" /><button type="submit">Parse</button></form>
          <div class="ah-chips">${EXAMPLES.map((e) => `<button type="button">${e}</button>`).join("")}</div>
          <div class="ah-out" aria-live="polite" hidden></div>
        </div>
        <h3>What you can say</h3>
        <ul class="ah-say">${SAY.map(([q, a]) => `<li><q>${q}</q><span>${a}</span></li>`).join("")}</ul>
        <h3>Ground rules</h3>
        <ul class="ah-rules">${RULES.map(([k, t]) => `<li><b>${k}.</b> ${t}</li>`).join("")}</ul>
      </div>
      <div class="ah-foot"><a href="vega.html">Open the full ASTRA page →</a><span>Simulated data · not a medical device</span></div>`;
    document.body.appendChild(el);

    el.querySelector(".ah-x").addEventListener("click", () => close());
    const tryBox = el.querySelector(".ah-try"), out = el.querySelector(".ah-out"), input = tryBox.querySelector("input");
    const run = (text) => {
      if (typeof VEGA === "undefined" || !VEGA.parse) return;   // VEGA is a const global: never window.VEGA
      const p = VEGA.parse(text);
      const slots = Object.entries(p.slots || {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
      out.innerHTML = `<span>you said</span> “${esc(text)}”<br><span>intent</span> ${esc(p.intent)} <span>· confidence</span> ${Math.round((p.confidence || 0) * 100)}%${slots ? `<br><span>details</span> ${slots}` : ""}`;
      out.hidden = false;
    };
    tryBox.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); if (input.value.trim()) run(input.value.trim()); });
    tryBox.querySelector(".ah-chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { input.value = b.textContent; run(b.textContent); } });

    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) close(); });
    document.addEventListener("pointerdown", (e) => {   // click outside closes it
      if (el.hidden || el.contains(e.target) || e.target.closest(".nav-help, .vb-help")) return;
      close(false);
    });
  }

  function setExpanded(v) { document.querySelectorAll(".nav-help, .vb-help").forEach((b) => b.setAttribute("aria-expanded", String(v))); }
  function open() {
    if (!el) build();
    // The parser box needs vega.js; hide it on pages without it.
    el.querySelector(".ah-try").hidden = typeof VEGA === "undefined" || !VEGA.parse;
    lastFocus = document.activeElement;
    el.hidden = false;
    setExpanded(true);
    el.querySelector(".ah-x").focus({ preventScroll: true });
  }
  function close(restoreFocus = true) {
    if (!el || el.hidden) return;
    el.hidden = true;
    setExpanded(false);
    if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  const isOpen = () => !!el && !el.hidden;
  css();   // style the nav "?" from the start
  return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen };
})();

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
