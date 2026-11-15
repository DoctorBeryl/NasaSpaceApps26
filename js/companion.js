/* ==========================================================
   AstraSight: home-page ASTRA pop-up (16-bit pixel companion)
   Load after vega.js and crew.js on index.html.

   - Starts collapsed (avatar only); clicking the avatar greets the
     crew member by name.
   - No background events. VegaBuddy.fireHazard() (the "Random health
     event" button on tools.html) pops up a random hazard, announces it
     on the ship PA, and links to the report screen with that scenario.
   - Every bubble has Acknowledge: stops ASTRA's voice and collapses.
   - Drag the portrait to move her; let go mid-drag to throw her (she
     bounces off the screen edges). Double-click sends her home; arrow
     keys move her. Position is saved per browser.
   - Stays hidden while report.html is open in another tab (that
     page sends heartbeats on ReportBus and does its own alerts).
   The sprite and moods match ASTRA on the report screen.
   ========================================================== */
(() => {
  /* ---------------- sprite (36x36, "Cobalt" palette) ---------------- */
  const PAL = {
    K: "#0A0E17", P: "#E2E8F0", M: "#94A3B8", L: "#FFFFFF", C: "#00F0FF", B: "#0284C7",
    S: "#FDE2D2", H: "#E2B49A", G: "#38BDF8", E: "#0F172A", W: "#FFFFFF", R: "#FF2A4B",
    A: "#FFB800", D: "#1E293B",
  };
  const HAIR = [
    "............KKKKKKKKKKKK............",
    "..........KKPPPPPPPPPPPPKK..........",
    "........KKPPLLLLPPPPPPPPPPKK........",
    ".......KPPPLLLLLPPPPPPPPPPPPK.......",
    "......KPPPPPPPPPPPPPPPMMPPPPPK......",
    ".....KPPPPPPPPPPPPPPPPMMMPPPPPK.....",
    "....CCKPPPPPPPPPPPPPPPMMMPPPPKCC....",
    "...CGGC.KPPPPPPPPPPPPPPPPPPK.CGGC...",
    "...CGGC.KPPPPLLLPPPPPPPPMMPK.CGGC...",
    "....CC.KPPPPPPPPPPPPPPPPPPMPK.CC....",
    "......KPPPPPPPKKKKKKKKPPPPPPPK......",
    "......KPPPPPKKSSSSSSSSKKPPPPPK......",
    ".....KPPPPPKSSSSSSSSSSSSKPPPPPK.....",
  ];
  const COLLAR = [
    "......KPPPK..KSSSSSSSSK..KPPPK......",
    ".....KPPPK....KKSSSSKK....KPPPK.....",
    ".....KPPK.....DDDDDDDD.....KPPK.....",
    "......KK....CCDDDDDDDDCC....KK......",
    "...........CGGDDDDDDDDGGC...........",
    "..........KDDDDDCCCCDDDDDK..........",
    ".........KDDDDCCCCCCCCDDDDK.........",
    ".........KDDDDDDDDDDDDDDDDK.........",
    "........KDDDDDDDDDDDDDDDDDDK........",
  ];
  const FACES = {
    nominal: [
      ".....KPPPPKSSSSSSSSSSSSSSKPPPPK.....",
      ".....KPPPKSSKKKSSSSSSKKKSSKPPPK.....",
      ".....KPPPKSSGWGSSSSSSGWGSSKPPPK.....",
      ".....KPPPKSSGEGSSSSSSGEGSSKPPPK.....",
      ".....KPPPKSSKKKSSSSSSKKKSSKPPPK.....",
      ".....KPPPKSSSSSSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSKSSKSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSKKKKSSSSSSKPPPK.....",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
    ],
    reminder: [
      ".....KPPPPKSSSSSSSSSSSSSSKPPPPK.....",
      ".....KPPPKSSKKKSSSSSSKKKSSKPPPK.....",
      ".....KPPPKSSGWGSSSSSSKKKSSKPPPK.....",
      ".....KPPPKSSGEGSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSKKKSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSSSSKKKKKKSSSSSKPPPK.....",
      ".....KPPPKSSSSSKWWWWKSSSSSKPPPK.....",
      "......KPPPKSSSSSKKKKSSSSSKPPPK......",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
    ],
    caution: [
      ".....KPPPPKSSSSSSSSSSSSSSKPPPPK.....",
      ".....KPPPKSSKKSSSSSSSSKKSSKPPPK.....",
      ".....KPPPKSSAAKSSSSSSKAAKSKPPPK.....",
      ".....KPPPKSSAWASSSSSSAWASSPPPPK.....",
      ".....KPPPKSSKKKSSSSSSKKKSSKPPPK.....",
      ".....KPPPKSSSSSSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSKKKKSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSSSSSSSSSSSKPPPK.....",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
    ],
    critical: [
      ".....KPPPPKSSSSSSSSSSSSSSKPPPPK.....",
      ".....KPPPKSRRRKSSSSSSKRRRKSKPPK.....",
      ".....KPPPKSRWRSSSSSSSSWRWSKPPPK.....",
      ".....KPPPKSRRRSSSSSSSSRRRSKPPPK.....",
      ".....KPPPKSSSSSSSSSSSSSSSSKPPPK.....",
      ".....KPPPKSSSSSSKKKKSSSSSSKPPPK.....",
      ".....KPPPKSSSSSKRRRRKSSSSSKPPPK.....",
      ".....KPPPKSSSSSKRRRRKSSSSSKPPPK.....",
      "......KPPPKSSSSSKKKKSSSSSKPPPK......",
      "......KPPPKSSSSSSSSSSSSSSKPPPK......",
    ],
  };

  function drawEmote(ctx, mood, phase) {
    const px = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (mood === "critical") {            // anger vein
      const ox = 27, oy = 2 + (phase % 2), r = "#FF1E42";
      px(r, ox + 2, oy, 1, 2); px(r, ox, oy + 2, 2, 1);
      px(r, ox + 4, oy, 1, 2); px(r, ox + 5, oy + 2, 2, 1);
      px(r, ox, oy + 4, 2, 1); px(r, ox + 2, oy + 5, 1, 2);
      px(r, ox + 5, oy + 4, 2, 1); px(r, ox + 4, oy + 5, 1, 2);
      px("#FFF", ox + 2, oy + 1); px("#FFF", ox + 5, oy + 2);
    } else if (mood === "caution") {      // sweat drop
      const sx = 30, sy = 11 + (phase % 2);
      px("#0A0E17", sx + 1, sy); px("#0A0E17", sx, sy + 1, 3, 4);
      px("#38BDF8", sx + 1, sy + 1, 1, 4); px("#38BDF8", sx, sy + 3, 3, 2);
      px("#FFF", sx + 1, sy + 3);
    } else if (mood === "reminder") {     // exclamation mark
      const ex = 30, ey = 2 + (phase % 2 ? -1 : 0);
      px("#0A0E17", ex - 1, ey - 1, 4, 9);
      px("#FFB800", ex, ey, 2, 4); px("#FFB800", ex, ey + 6, 2, 2); px("#FFF", ex, ey, 1, 2);
    } else {                              // sparkle
      const c = phase % 2 ? "#FFFFFF" : "#00F0FF";
      px(c, 31, 3, 1, 5); px(c, 29, 5, 5, 1);
    }
  }

  function draw(ctx, mood, phase, blink) {
    ctx.clearRect(0, 0, 36, 36);
    const rows = [...HAIR, ...(FACES[mood] || FACES.nominal), ...COLLAR];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        let ch = row[x];
        if (blink && mood === "nominal" && y >= 14 && y <= 16 && "GWE".includes(ch)) ch = "K";
        if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
      }
    });
    drawEmote(ctx, mood, phase);
  }

  /* ---------------- background hazards (mirror report.html presets) ---------------- */
  const HAZARDS = [
    { key: "rad-crit", mood: "critical", scenario: "radiation", loc: "Radiation and shelter timer",
      msg: "Solar particle event. Radiation is 18.5 mSv/hr outside the hull and the safe window is down to 2:45. Stop the EVA and get behind hull shielding now." },
    { key: "exertion-crit", mood: "critical", scenario: "exertion", loc: "DCS risk and biometrics",
      msg: "Heart rate 162 BPM and workload 520 W are pushing decompression risk to R 1.71. Pause physical work for 3 minutes." },
    { key: "pressure-crit", mood: "critical", scenario: "microleak", loc: "Suit pressure",
      msg: "Suit pressure dropped to 3.25 PSI, a possible micro-leak. Start the secondary O2 purge and return to the airlock now." },
    { key: "o2-warn", mood: "caution", scenario: "microleak", loc: "Primary O2 tank",
      msg: "Primary O2 is at 34%, the turnaround point. Finish this task and head back toward the airlock." },
    { key: "rad-warn", mood: "reminder", scenario: "radiation", loc: "Radiation and shelter timer",
      msg: "Solar activity is rising: 4.2 mSv/hr. The safe window is 7:30. Start wrapping up outside work." },
  ];
  const SNOOZE_MS = 60000;

  const LABEL = { nominal: "NOMINAL", caution: "CAUTION", reminder: "TIMER ALERT", critical: "URGENT" };
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------- DOM ---------------- */
  const root = document.createElement("aside");
  root.className = "vega-buddy";
  root.dataset.mood = "nominal";
  root.hidden = true;
  root.setAttribute("aria-label", "ASTRA assistant");
  root.innerHTML = `
    <div class="vb-bubble" role="status" aria-live="polite">
      <div class="vb-head">
        <span class="vb-badge"><i></i><span class="vb-badge-text">ASTRA · NOMINAL</span></span>
        <button type="button" class="vb-x" aria-label="Minimize ASTRA">✕</button>
      </div>
      <p class="vb-msg"></p>
      <form class="vb-name" hidden>
        <select aria-label="Rank"><option value="">Rank</option>${Crew.RANKS.map((r) => `<option>${r}</option>`).join("")}</select>
        <input type="text" maxlength="40" placeholder="Your name" aria-label="Your name" />
        <button type="submit">Save</button>
      </form>
      <div class="vb-actions">
        <button type="button" class="vb-ack">Acknowledge</button>
        <a class="vb-open" href="report.html">Open report screen →</a>
        <button type="button" class="vb-pa" aria-pressed="true" title="Ship PA announcements"></button>
      </div>
      <p class="vb-foot">Simulated data · not a medical device</p>
    </div>
    <button type="button" class="vb-avatar" aria-label="Talk to ASTRA">
      <canvas width="36" height="36"></canvas>
      <span>ASTRA</span>
    </button>`;
  document.body.appendChild(root);

  // Static sprites elsewhere on the page: <canvas data-vega-sprite="nominal" width="36" height="36">
  document.querySelectorAll("canvas[data-vega-sprite]").forEach((c) => draw(c.getContext("2d"), c.dataset.vegaSprite || "nominal", 0, false));

  const $ = (s) => root.querySelector(s);
  const ctx = $("canvas").getContext("2d");
  const bubble = $(".vb-bubble"), msgEl = $(".vb-msg"), nameForm = $(".vb-name"), openLink = $(".vb-open");

  let mood = "nominal", phase = 0, reportOpen = false, lastBeat = 0, snoozeUntil = 0, hazardIdx = -1, tipIdx = 0;
  const redraw = (blink = false) => draw(ctx, mood, phase, blink);

  function setMood(m) {
    mood = m;
    root.dataset.mood = m;
    $(".vb-badge-text").textContent = `ASTRA · ${LABEL[m] || "NOMINAL"}`;
    redraw();
  }

  function show({ m = "nominal", html, askName = false, scenario = null, force = false }) {
    if (reportOpen && !force) return;
    setMood(m);
    msgEl.innerHTML = html;
    nameForm.hidden = !askName;
    openLink.href = scenario ? `report.html?scenario=${scenario}` : "report.html";
    openLink.textContent = scenario ? "Open report screen for this alert →" : "Open report screen →";
    root.hidden = false;
    root.classList.remove("minimized");
    if (!reduceMotion) { root.classList.remove("pop"); void root.offsetWidth; root.classList.add("pop"); }
    if (askName) setTimeout(() => nameForm.querySelector("input").focus({ preventScroll: true }), 50);
  }

  function minimize() { root.classList.add("minimized"); setMood("nominal"); }
  // Avatar only, no speech bubble: the resting state. Click the avatar to open the greeting.
  function collapsed() { if (reportOpen) return; root.hidden = false; minimize(); }

  /* ---------------- greeting & tips ---------------- */
  const TIPS = [
    "To see how I handle an emergency, press Random health event on the Diagnostics page. I'll pop up with the alert.",
    "On the report screen, every alert is announced on the ship PA with your name, so the whole crew knows who needs help.",
    "Danger-zone readings always go to the flight surgeon. I flag and suggest; I don't diagnose.",
    "Outside the hull, a solar particle event can cut your safe EVA window to minutes. I'll count it down for you.",
  ];
  function greet() {
    const first = Crew.firstName();
    if (!first) {
      // Guest: never ask for a name. Signed-in crew get theirs from sign-in and the questionnaire.
      show({ html: `Hi, I'm <b>ASTRA</b>, your on-board health assistant. You're browsing as a guest. <a href="login.html" style="color:var(--cyan)">Sign in</a> and I'll use your name in alerts and ship PA announcements. ${esc(TIPS[tipIdx++ % TIPS.length])}` });
    } else {
      show({ html: `Hi <b>${esc(first)}</b>, ASTRA here. ${esc(TIPS[tipIdx++ % TIPS.length])}` });
    }
  }

  /* ---------------- alerts ---------------- */
  /* On demand only. force: show even while the report screen is open in another tab
     (an explicit button press beats the "report screen handles it" rule). */
  function fireHazard({ force = false } = {}) {
    if (!force && (reportOpen || Date.now() < snoozeUntil)) return;
    let i; do { i = Math.floor(Math.random() * HAZARDS.length); } while (HAZARDS.length > 1 && i === hazardIdx);
    hazardIdx = i;
    const h = HAZARDS[i];
    const first = Crew.firstName();
    show({
      m: h.mood, force,
      scenario: h.scenario,
      html: `<span class="vb-loc">${esc(h.loc)}</span>${first ? `<b>${esc(first)}</b>, ${esc(h.msg[0].toLowerCase() + h.msg.slice(1))}` : esc(h.msg)}`,
    });
    // Browsers only allow sound after the visitor has interacted with the page.
    const activated = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (activated) ShipPA.announce({ mood: h.mood, msg: h.msg, loc: h.loc });
  }

  /* ---------------- events ---------------- */
  $(".vb-x").addEventListener("click", () => {
    if (mood !== "nominal") snoozeUntil = Date.now() + SNOOZE_MS;
    ShipPA.stopVoice();
    minimize();
  });
  // Acknowledge: stop the voice, forget the alert (so PA on won't replay it), collapse.
  $(".vb-ack").addEventListener("click", () => { ShipPA.ack(); minimize(); });
  // Wait a moment before greeting so a double-click (send ASTRA home) can cancel it;
  // otherwise the greeting's teleport animation would move the portrait out from under the second click.
  let clickTimer = 0;
  $(".vb-avatar").addEventListener("click", (e) => {
    if (justDragged) return;   // the end of a drag isn't a click
    clearTimeout(clickTimer);
    if (e.detail > 1) return;
    const run = () => { if (root.classList.contains("minimized") || mood === "nominal") greet(); };
    if (e.detail === 0) run();   // keyboard (Enter / Space): no double-click to wait for
    else clickTimer = setTimeout(run, 260);
  });

  /* ---------------- drag, throw, bounce ----------------
     Grab the portrait and drag ASTRA anywhere: she tilts with the motion. Let go while
     moving and she glides on, bouncing off the screen edges with a squash. The bubble
     flips to whichever side has room. Position is remembered per browser (as a fraction
     of the window); double-click the portrait to send her home. Arrow keys move her too. */
  const POS_KEY = "astrasight.astra.pos";
  const av = $(".vb-avatar");
  av.title = "Click to talk · drag (or throw) to move · double-click to send ASTRA home";
  let pos = null;            // portrait centre in viewport px; null = default corner
  let drag = null, flingId = 0, justDragged = false;
  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY));
    if (s && Number.isFinite(s.fx) && Number.isFinite(s.fy)) pos = { x: s.fx * innerWidth, y: s.fy * innerHeight };
  } catch { /* storage blocked */ }
  function savePos() {
    try {
      if (pos) localStorage.setItem(POS_KEY, JSON.stringify({ fx: pos.x / innerWidth, fy: pos.y / innerHeight }));
      else localStorage.removeItem(POS_KEY);
    } catch { /* storage blocked */ }
  }
  function orient() {
    root.classList.toggle("vb-left", pos.x < innerWidth / 2);
    root.classList.toggle("vb-top", pos.y < innerHeight * 0.4);
  }
  // Where the portrait centre may go so the whole card stays on screen.
  function bounds() {
    const m = 8, ax = av.offsetLeft + av.offsetWidth / 2, ay = av.offsetTop + av.offsetHeight / 2;
    const minX = m + ax, minY = m + ay;
    return { ax, ay, minX, minY,
      maxX: Math.max(minX, innerWidth - m - (root.offsetWidth - ax)),
      maxY: Math.max(minY, innerHeight - m - (root.offsetHeight - ay)) };
  }
  function place() {
    if (!pos) {
      root.classList.remove("placed", "vb-left", "vb-top");
      root.style.left = root.style.top = "";
      return;
    }
    root.classList.add("placed");
    orient();
    const b = bounds();
    const x = Math.min(Math.max(pos.x, b.minX), b.maxX), y = Math.min(Math.max(pos.y, b.minY), b.maxY);
    root.style.left = `${x - b.ax}px`;
    root.style.top = `${y - b.ay}px`;
  }
  function bonk() {
    root.classList.remove("bonk"); void av.offsetWidth; root.classList.add("bonk");
  }
  av.addEventListener("animationend", (e) => { if (e.animationName === "vb-bonk") root.classList.remove("bonk"); });

  function fling(vx, vy) {   // velocities in px per 60 Hz frame
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(48, now - last) / 16.67; last = now;
      pos.x += vx * dt; pos.y += vy * dt;
      const k = Math.pow(0.945, dt); vx *= k; vy *= k;
      orient();
      const b = bounds();
      let hit = 0;
      if (pos.x < b.minX) { pos.x = b.minX; hit = Math.abs(vx); vx = -vx * 0.6; }
      else if (pos.x > b.maxX) { pos.x = b.maxX; hit = Math.abs(vx); vx = -vx * 0.6; }
      if (pos.y < b.minY) { pos.y = b.minY; hit = Math.max(hit, Math.abs(vy)); vy = -vy * 0.6; }
      else if (pos.y > b.maxY) { pos.y = b.maxY; hit = Math.max(hit, Math.abs(vy)); vy = -vy * 0.6; }
      if (hit > 3) bonk();
      place();
      if (Math.hypot(vx, vy) > 0.3) flingId = requestAnimationFrame(step);
      else { flingId = 0; savePos(); }
    };
    flingId = requestAnimationFrame(step);
  }

  av.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(flingId); flingId = 0;
    const r = av.getBoundingClientRect();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY,
      ox: e.clientX - (r.left + r.width / 2), oy: e.clientY - (r.top + r.height / 2),
      moved: false, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    try { av.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  av.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;   // a plain click isn't a drag
      drag.moved = true;
      root.classList.add("dragging");
    }
    drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
    const s0 = drag.samples[0], dt = Math.max(1, e.timeStamp - s0.t);
    const tilt = Math.max(-28, Math.min(28, ((e.clientX - s0.x) / dt) * 22));
    root.style.setProperty("--vb-tilt", `${reduceMotion ? 0 : tilt.toFixed(1)}deg`);
    pos = { x: e.clientX - drag.ox, y: e.clientY - drag.oy };
    place();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    root.classList.remove("dragging");
    root.style.setProperty("--vb-tilt", "0deg");
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 250);
    // Throw velocity from the last ~90 ms of movement; a pause before letting go means no throw.
    const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1], dt = s1.t - s0.t;
    const fresh = e.timeStamp - s1.t < 60 && dt > 0;
    const vx = fresh ? ((s1.x - s0.x) / dt) * 16.67 : 0, vy = fresh ? ((s1.y - s0.y) / dt) * 16.67 : 0;
    const cap = 60, sp = Math.hypot(vx, vy), f = sp > cap ? cap / sp : 1;
    if (!reduceMotion && sp > 2) fling(vx * f, vy * f);
    else savePos();
  }
  av.addEventListener("pointerup", endDrag);
  av.addEventListener("pointercancel", endDrag);
  av.addEventListener("dblclick", () => {
    clearTimeout(clickTimer);
    cancelAnimationFrame(flingId); flingId = 0;
    pos = null; savePos(); place();
    if (!reduceMotion) { root.classList.remove("pop"); void root.offsetWidth; root.classList.add("pop"); }
  });
  av.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 80 : 24;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (!pos) { const r = av.getBoundingClientRect(); pos = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    pos.x += d[0]; pos.y += d[1];
    place();
    const b = bounds(); pos.x = Math.min(Math.max(pos.x, b.minX), b.maxX); pos.y = Math.min(Math.max(pos.y, b.minY), b.maxY);
    savePos();
  });
  // Re-fit when the bubble opens or closes, or the window changes size.
  if (window.ResizeObserver) new ResizeObserver(() => { if (!drag && !flingId) place(); }).observe(root);
  addEventListener("resize", () => {
    try { const s = JSON.parse(localStorage.getItem(POS_KEY)); if (s && pos) pos = { x: s.fx * innerWidth, y: s.fy * innerHeight }; } catch { /* ignore */ }
    place();
  });
  place();
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameForm.querySelector("input").value.trim();
    if (!name) return;
    Crew.set({ name, rank: nameForm.querySelector("select").value });
    show({ html: `Nice to meet you, <b>${esc(Crew.callSign())}</b>. ${esc(TIPS[0])}` });
  });

  // The signed-in name (js/auth.js) or questionnaire call sign can arrive after a guest greeting.
  Crew.onChange(() => { if (Crew.firstName() && !root.hidden && !root.classList.contains("minimized") && mood === "nominal" && /as a guest/.test(msgEl.textContent)) greet(); });

  const paBtn = $(".vb-pa");
  function paLabel() {
    paBtn.textContent = ShipPA.enabled ? "🔊 PA on" : "🔇 PA off";
    paBtn.setAttribute("aria-pressed", String(ShipPA.enabled));
  }
  paLabel();
  // PA on re-reads the current alert from the start (ShipPA.setEnabled handles it).
  paBtn.addEventListener("click", () => { ShipPA.setEnabled(!ShipPA.enabled); paLabel(); });

  /* report.html open in another tab? It sends a heartbeat every second. */
  function setReportOpen(open) {
    if (open === reportOpen) return;
    reportOpen = open;
    if (open) root.hidden = true;
    else collapsed();
  }
  ReportBus.on((m) => {
    if (!m) return;
    if (m.type === "heartbeat" || m.type === "alert") { lastBeat = Date.now(); setReportOpen(true); }
    if (m.type === "bye") { lastBeat = 0; setReportOpen(false); }
  });
  setInterval(() => { if (reportOpen && Date.now() - lastBeat > 3000) setReportOpen(false); }, 1000);

  /* animation */
  setInterval(() => { phase++; redraw(); }, 650);
  setInterval(() => { if (mood === "nominal") { redraw(true); setTimeout(() => redraw(), 150); } }, 4000);
  redraw();

  /* start: ask whether the report screen is open; if it isn't, show ASTRA collapsed (no greeting) */
  ReportBus.send({ type: "ping" });
  setTimeout(() => {
    collapsed();
  }, 600);

  window.VegaBuddy = { greet, fireHazard, get reportOpen() { return reportOpen; } };
})();
