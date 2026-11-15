/* ==========================================================
   AstraSight: ASTRA help button on the home and diagnostics pages
   Load after vega.js and crew.js.

   - Rests as a small "?" button in the corner. Clicking it opens
     ASTRA's explanation of the page: what AstraSight is, who ASTRA
     is, and where to go next. Click it again, press Esc or the X to
     close it.
   - No background events. VegaBuddy.fireHazard() (the "Random health
     event" button on tools.html) pops up a random hazard, announces it
     on the ship PA, and links to the report screen with that scenario.
   - Alert bubbles have Acknowledge: stops ASTRA's voice and closes.
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

  const LABEL = { nominal: "HELP", caution: "CAUTION", reminder: "TIMER ALERT", critical: "URGENT" };
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------- DOM ---------------- */
  const root = document.createElement("aside");
  root.className = "vega-buddy minimized";
  root.dataset.mood = "nominal";
  root.dataset.mode = "help";
  root.hidden = true;
  root.setAttribute("aria-label", "ASTRA help");
  root.innerHTML = `
    <div class="vb-bubble" id="vb-bubble" role="status" aria-live="polite">
      <div class="vb-head">
        <span class="vb-badge"><canvas class="vb-face" width="36" height="36" aria-hidden="true"></canvas><i></i><span class="vb-badge-text">ASTRA · HELP</span></span>
        <button type="button" class="vb-x" aria-label="Close">✕</button>
      </div>
      <div class="vb-msg"></div>
      <div class="vb-actions">
        <button type="button" class="vb-ack">Acknowledge</button>
        <a class="vb-open" href="report.html">Open report screen →</a>
        <button type="button" class="vb-pa" aria-pressed="true" title="Ship PA announcements"></button>
      </div>
      <p class="vb-foot">Concept prototype · simulated data · not a medical device</p>
    </div>
    <button type="button" class="vb-help" aria-label="What is this? ASTRA explains" aria-controls="vb-bubble" aria-expanded="false">?</button>`;
  document.body.appendChild(root);

  // Static sprites elsewhere on the page: <canvas data-vega-sprite="nominal" width="36" height="36">
  document.querySelectorAll("canvas[data-vega-sprite]").forEach((c) => draw(c.getContext("2d"), c.dataset.vegaSprite || "nominal", 0, false));

  const $ = (s) => root.querySelector(s);
  const ctx = $(".vb-face").getContext("2d");
  const msgEl = $(".vb-msg"), openLink = $(".vb-open"), helpBtn = $(".vb-help");

  let mood = "nominal", phase = 0, reportOpen = false, lastBeat = 0, snoozeUntil = 0, hazardIdx = -1, tipIdx = 0, mode = "help";
  const redraw = (blink = false) => draw(ctx, mood, phase, blink);

  function setMood(m) {
    mood = m;
    root.dataset.mood = m;
    $(".vb-badge-text").textContent = `ASTRA · ${LABEL[m] || "HELP"}`;
    redraw();
  }

  function show({ m = "nominal", html, scenario = null, link = null, alert = false, force = false }) {
    if (reportOpen && !force) return;
    mode = alert ? "alert" : "help";
    root.dataset.mode = mode;
    setMood(m);
    msgEl.innerHTML = html;
    if (link) { openLink.href = link.href; openLink.textContent = link.text; }
    else {
      openLink.href = scenario ? `report.html?scenario=${scenario}` : "report.html";
      openLink.textContent = scenario ? "Open report screen for this alert →" : "Open report screen →";
    }
    root.hidden = false;
    root.classList.remove("minimized");
    helpBtn.setAttribute("aria-expanded", "true");
    if (!reduceMotion) { root.classList.remove("pop"); void root.offsetWidth; root.classList.add("pop"); }
  }

  function minimize() {
    root.classList.add("minimized");
    helpBtn.setAttribute("aria-expanded", "false");
    setMood("nominal");
  }
  // Just the "?" button: the resting state.
  function collapsed() { if (reportOpen) return; root.hidden = false; minimize(); }

  /* ---------------- help ---------------- */
  const TIPS = [
    "To see how I handle an emergency, press Random health event on the Diagnostics page.",
    "On the report screen, every alert is announced on the ship PA with your name, so the whole crew knows who needs help.",
    "Outside the hull, a solar particle event can cut your safe EVA window to minutes. I count it down for you.",
    "Say “Hey ASTRA” or press V on the live interface to talk to me.",
  ];
  const onTools = /tools\.html$/.test(location.pathname);
  function helpHtml() {
    const first = Crew.firstName();
    const hi = first ? `Hi <b>${esc(first)}</b>. ` : "";
    const intro = onTools
      ? `${hi}This page shows the eight diagnostic tools one at a time: what each one measures, which helmet sensor it uses, and a demo of the signal.`
      : `${hi}<b>AstraSight</b> is a concept health display built into an astronaut's helmet. Sensors track eight vital signs and a small panel inside the visor shows them. I'm <b>ASTRA</b>, the voice assistant that reads them, explains them and suggests what to do.`;
    const items = onTools
      ? [
          ["Pick a tool", "from the list to see its readings and the steps to run it."],
          ["Random health event", "shows how I alert you when a reading needs action."],
          ["Report screen", "is the full medical view for EVAs and the crew medical officer."],
        ]
      : [
          ["Launch the interface", "to try the visor display and talk to me by voice or typed commands."],
          ["Diagnostics", "explains each of the eight tools."],
          ["Report", "is the mission medical screen for EVAs and the crew medical officer."],
        ];
    return `<p>${intro}</p>
      <ul class="vb-list">${items.map(([k, t]) => `<li><b>${k}</b> ${t}</li>`).join("")}</ul>
      <p class="vb-note">I flag and suggest; I don't diagnose. Serious findings go to the flight surgeon.</p>
      <p class="vb-tip"><span>Tip</span> ${esc(TIPS[tipIdx++ % TIPS.length])}</p>`;
  }
  function explain() {
    show({ html: helpHtml(), link: onTools ? { href: "report.html", text: "Open report screen →" } : { href: "interface.html", text: "Launch the interface →" } });
  }
  // Kept for callers of the old pop-up: greeting now opens the explanation.
  const greet = explain;

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
      m: h.mood, force, alert: true,
      scenario: h.scenario,
      html: `<span class="vb-loc">${esc(h.loc)}</span>${first ? `<b>${esc(first)}</b>, ${esc(h.msg[0].toLowerCase() + h.msg.slice(1))}` : esc(h.msg)}`,
    });
    // Browsers only allow sound after the visitor has interacted with the page.
    const activated = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (activated) ShipPA.announce({ mood: h.mood, msg: h.msg, loc: h.loc });
  }

  /* ---------------- events ---------------- */
  function close() {
    if (mood !== "nominal") snoozeUntil = Date.now() + SNOOZE_MS;
    if (mode === "alert") ShipPA.stopVoice();
    minimize();
  }
  $(".vb-x").addEventListener("click", close);
  // Acknowledge: stop the voice, forget the alert (so PA on won't replay it), close.
  $(".vb-ack").addEventListener("click", () => { ShipPA.ack(); minimize(); });
  // "?" opens the explanation; pressed again it closes it. During an alert it switches to the explanation.
  helpBtn.addEventListener("click", () => {
    if (root.classList.contains("minimized") || mode === "alert") explain();
    else close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mode === "help" && !root.classList.contains("minimized")) { minimize(); helpBtn.focus(); }
  });

  // The signed-in name (js/auth.js) can arrive after the explanation opened.
  Crew.onChange(() => { if (mode === "help" && !root.classList.contains("minimized")) msgEl.innerHTML = helpHtml(); });

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

  /* start: ask whether the report screen is open; if it isn't, show the "?" button */
  ReportBus.send({ type: "ping" });
  setTimeout(() => {
    collapsed();
  }, 600);

  window.VegaBuddy = { greet, explain, fireHazard, get reportOpen() { return reportOpen; } };
})();
