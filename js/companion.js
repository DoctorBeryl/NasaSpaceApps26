/* ==========================================================
   AstraSight: home-page VEGA pop-up (16-bit pixel companion)
   Load after vega.js and crew.js on index.html.

   - Starts collapsed (avatar only); clicking the avatar greets the
     crew member by name.
   - No background events. VegaBuddy.fireHazard() (the "Random health
     event" button on tools.html) pops up a random hazard, announces it
     on the ship PA, and links to the report screen with that scenario.
   - Every bubble has Acknowledge: stops VEGA's voice and collapses.
   - Stays hidden while report.html is open in another tab (that
     page sends heartbeats on ReportBus and does its own alerts).
   The sprite and moods match VEGA on the report screen.
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
  root.setAttribute("aria-label", "VEGA assistant");
  root.innerHTML = `
    <div class="vb-bubble" role="status" aria-live="polite">
      <div class="vb-head">
        <span class="vb-badge"><i></i><span class="vb-badge-text">VEGA · NOMINAL</span></span>
        <button type="button" class="vb-x" aria-label="Minimize VEGA">✕</button>
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
    <button type="button" class="vb-avatar" aria-label="Talk to VEGA">
      <canvas width="36" height="36"></canvas>
      <span>VEGA</span>
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
    $(".vb-badge-text").textContent = `VEGA · ${LABEL[m] || "NOMINAL"}`;
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
      show({ html: "Hi, I'm <b>VEGA</b>, your on-board health assistant. What should I call you? I use your name in alerts and ship PA announcements.", askName: true });
    } else {
      show({ html: `Hi <b>${esc(first)}</b>, VEGA here. ${esc(TIPS[tipIdx++ % TIPS.length])}` });
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
  $(".vb-avatar").addEventListener("click", () => {
    if (root.classList.contains("minimized") || mood === "nominal") greet();
  });
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameForm.querySelector("input").value.trim();
    if (!name) return;
    Crew.set({ name, rank: nameForm.querySelector("select").value });
    show({ html: `Nice to meet you, <b>${esc(Crew.callSign())}</b>. ${esc(TIPS[0])}` });
  });

  // The signed-in name (js/auth.js) can arrive after the greeting asked for one.
  Crew.onChange(() => { if (!nameForm.hidden && Crew.firstName() && !root.hidden) greet(); });

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

  /* start: ask whether the report screen is open; if it isn't, show VEGA collapsed (no greeting) */
  ReportBus.send({ type: "ping" });
  setTimeout(() => {
    collapsed();
  }, 600);

  window.VegaBuddy = { greet, fireHazard, get reportOpen() { return reportOpen; } };
})();
