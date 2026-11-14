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
  ["vega.html", "VEGA AI"],
  ["report.html", "Report"],
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
