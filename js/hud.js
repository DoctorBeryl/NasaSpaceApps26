/* ==========================================================
   AstraSight — HUD interface controller
   Simulated vitals, side panel and VEGA command execution.
   ========================================================== */
(() => {
  const $ = (s) => document.querySelector(s);
  const shell = $("#shell");
  const panel = $("#panel");
  const vitalsEl = $("#tab-vitals");
  const logEl = $("#tab-log");
  const input = $("#cmd");
  const micBtn = $("#mic");

  const HISTORY = 48;
  const state = {
    values: {}, history: {}, override: {},
    focus: null, dock: "right", visible: true,
    alert: null, scanning: false, breathingTimer: null,
    start: Date.now(),
  };

  /* ---------------- vitals simulation ---------------- */
  TOOLS.forEach((t) => {
    state.values[t.id] = t.base;
    state.history[t.id] = Array.from({ length: HISTORY }, () => t.base + (Math.random() - 0.5) * t.jitter);
  });

  function step(t) {
    const target = state.override[t.id] ?? t.base;
    const v = state.values[t.id];
    let next = v + (target - v) * 0.12 + (Math.random() - 0.5) * t.jitter * 0.6;
    next = Math.max(t.min, Math.min(t.max, next));
    state.values[t.id] = next;
    const h = state.history[t.id]; h.push(next); if (h.length > HISTORY) h.shift();
  }

  const fmt = (t, v = state.values[t.id]) => v.toFixed(t.decimals);

  /* ---------------- render panel ---------------- */
  vitalsEl.innerHTML = TOOLS.map((t) => `
    <div class="vital" data-id="${t.id}" tabindex="0">
      <div class="vital-name">${ICONS[t.icon]}<span>${t.name}</span><span class="dot"></span></div>
      <div class="vital-value"><span class="v">${fmt(t)}</span><small>${t.unit}</small></div>
      <canvas></canvas>
      <div class="vital-detail">
        <div class="row"><span>Normal range</span><span>${t.range}</span></div>
        <div class="row"><span>Sensor</span><span>${t.sensor}</span></div>
        <div class="row"><span>Baseline</span><span>${fmt(t, t.base)} ${t.unit}</span></div>
        <div class="row"><span>Trend (48s)</span><span class="trend">—</span></div>
        <div class="row" style="margin-top:6px"><a href="tools.html#${t.id}" style="color:var(--cyan)">Open tool demo →</a><span></span></div>
      </div>
    </div>`).join("");

  const cards = {};
  vitalsEl.querySelectorAll(".vital").forEach((el) => {
    cards[el.dataset.id] = el;
    el.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      setFocus(state.focus === el.dataset.id ? null : el.dataset.id);
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") el.click(); });
  });

  function renderVitals() {
    let warn = 0;
    TOOLS.forEach((t) => {
      const el = cards[t.id];
      const v = state.values[t.id];
      const st = toolStatus(t, v);
      if (st !== "ok") warn++;
      el.querySelector(".v").textContent = fmt(t);
      const dot = el.querySelector(".vital-name .dot");
      dot.className = "dot" + (st === "warn" ? (state.alert === t.id ? " crit pulse" : " warn") : "");
      const h = state.history[t.id];
      const delta = h[h.length - 1] - h[0];
      el.querySelector(".trend").textContent = (delta >= 0 ? "▲ +" : "▼ ") + delta.toFixed(t.decimals || 1);
      const color = state.alert === t.id ? "#ff5d73" : st === "warn" ? "#ffc65c" : "#5ef2ff";
      drawSpark(el.querySelector("canvas"), h, color);
    });

    const score = Math.max(0, Math.round(96 - warn * 14 - (state.values.cog - 30) * 0.15 + (state.values.hrv - 55) * 0.1));
    $("#score").textContent = score;
    $("#score-arc").style.strokeDashoffset = 201 - (201 * score) / 100;
    $("#summary-title").textContent = state.alert ? "Priority alert active" : warn ? `${warn} reading${warn > 1 ? "s" : ""} need attention` : "All systems nominal";
    $("#summary-text").textContent = `${TOOLS.length - warn} of ${TOOLS.length} diagnostics within your baseline.`;
  }

  function setFocus(id) {
    state.focus = id;
    Object.entries(cards).forEach(([k, el]) => el.classList.toggle("focus", k === id));
    if (id) {
      showTab("vitals");
      setTimeout(() => cards[id].scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  /* ---------------- panel controls ---------------- */
  function setVisible(v) {
    state.visible = v;
    panel.classList.toggle("hidden", !v);
    shell.classList.toggle("panel-hidden", !v);
    $("#reopen").classList.toggle("show", !v);
  }
  function setDock(side) {
    state.dock = side;
    panel.classList.toggle("left", side === "left");
    shell.classList.toggle("dock-left", side === "left");
  }
  function showTab(name) {
    document.querySelectorAll(".sp-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    vitalsEl.hidden = name !== "vitals";
    logEl.hidden = name !== "log";
  }

  $("#hide-btn").onclick = () => setVisible(false);
  $("#reopen").onclick = () => setVisible(true);
  $("#dock-btn").onclick = () => setDock(state.dock === "right" ? "left" : "right");
  document.querySelectorAll(".sp-tab").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  /* ---------------- log + response ---------------- */
  function log(kind, text) {
    const d = new Date();
    const time = d.toTimeString().slice(0, 8);
    const item = document.createElement("div");
    item.className = `log-item ${kind}`;
    item.innerHTML = `<time>${time}</time>${kind === "user" ? "› " : kind === "ai" ? "VEGA: " : "SYS: "}`;
    item.appendChild(document.createTextNode(text));
    logEl.prepend(item);
  }

  let respTimer;
  function respond(text, { speak = true } = {}) {
    $("#response-text").textContent = text;
    const r = $("#response");
    r.classList.add("show");
    clearTimeout(respTimer);
    respTimer = setTimeout(() => r.classList.remove("show"), Math.max(5000, text.length * 70));
    log("ai", text);
    if (speak) VEGA.speak(text);
  }

  let alertTimer;
  function toast(text, kind = "crit", ms = 0) {
    const a = $("#alert");
    $("#alert-text").textContent = text;
    a.classList.toggle("info", kind === "info");
    a.querySelector(".dot").className = "dot pulse " + (kind === "info" ? "" : "crit");
    a.classList.add("show");
    clearTimeout(alertTimer);
    if (ms) alertTimer = setTimeout(() => a.classList.remove("show"), ms);
  }
  const hideToast = () => $("#alert").classList.remove("show");

  function sweep() {
    const s = $("#sweep");
    s.classList.remove("run"); void s.offsetWidth; s.classList.add("run");
  }

  /* ---------------- VEGA command execution ---------------- */
  function describe(t) {
    const v = state.values[t.id];
    const st = toolStatus(t, v);
    const val = `${fmt(t)} ${t.unit.replace("/100", "out of 100").replace("rpm", "breaths per minute").replace("mSv/d", "millisieverts per day")}`;
    return st === "ok"
      ? `Your ${t.short.toLowerCase()} is ${val}, within your normal range.`
      : `Your ${t.short.toLowerCase()} is ${val}, outside your normal range of ${t.range}.`;
  }

  function statusReport() {
    const off = TOOLS.filter((t) => toolStatus(t, state.values[t.id]) !== "ok");
    const hr = toolById("cardio"), o2 = toolById("spo2");
    let s = `Readiness ${$("#score").textContent}. Heart rate ${fmt(hr)}, oxygen ${fmt(o2)} percent. `;
    s += off.length ? `Attention needed on ${off.map((t) => t.short).join(", ")}.` : "All other diagnostics are nominal.";
    return s;
  }

  function scanTool(id, done) {
    const el = cards[id];
    el.classList.add("scanning");
    setTimeout(() => { el.classList.remove("scanning"); done && done(); }, 700);
  }

  function fullScan() {
    if (state.scanning) return respond("A scan is already in progress.");
    state.scanning = true;
    setVisible(true); showTab("vitals"); setFocus(null);
    respond("Starting full diagnostic scan. Hold still for a moment.");
    sweep();
    let i = 0;
    const next = () => {
      if (i >= TOOLS.length) {
        state.scanning = false;
        sweep();
        return respond("Scan complete. " + statusReport());
      }
      const t = TOOLS[i++];
      cards[t.id].scrollIntoView({ behavior: "smooth", block: "nearest" });
      scanTool(t.id, next);
    };
    setTimeout(next, 600);
  }

  function breathing() {
    clearInterval(state.breathingTimer);
    const phases = ["Breathe in… 4", "Hold… 4", "Breathe out… 6"];
    let n = 0;
    state.override.hrv = 72; state.override.cardio = 64;
    toast(phases[0], "info");
    state.breathingTimer = setInterval(() => {
      n++;
      if (n >= 12) {
        clearInterval(state.breathingTimer); hideToast();
        delete state.override.hrv; delete state.override.cardio;
        return respond("Nice work. Your heart rate variability has improved.");
      }
      toast(phases[n % 3], "info");
    }, 4000);
  }

  function execute(raw) {
    const p = VEGA.parse(raw);
    log("user", raw);
    const tool = p.slots.tool && toolById(p.slots.tool);

    switch (p.intent) {
      case "show_tool":
        setVisible(true); setFocus(tool.id);
        return respond(describe(tool));
      case "scan_tool":
        setVisible(true); setFocus(tool.id); sweep();
        respond(`Running ${tool.name.toLowerCase()} scan.`, { speak: false });
        VEGA.speak(`Running ${tool.name.toLowerCase()} scan.`);
        return scanTool(tool.id, () => setTimeout(() => respond(`Scan complete. ${describe(tool)}`), 300));
      case "full_scan": return fullScan();
      case "status_report": return respond(statusReport());
      case "panel_hide": setVisible(false); return respond("Panel hidden. Say “show panel” to bring it back.");
      case "panel_show": setVisible(true); return respond("Panel restored.");
      case "dock_left": setVisible(true); setDock("left"); return respond("Panel docked left.");
      case "dock_right": setVisible(true); setDock("right"); return respond("Panel docked right.");
      case "show_log": setVisible(true); showTab("log"); return respond("Showing command log.");
      case "show_vitals": setVisible(true); showTab("vitals"); return respond("Showing vitals.");
      case "simulate_alert":
        state.alert = "spo2"; state.override.spo2 = 88.5; state.override.cardio = 104;
        setVisible(true); setFocus("spo2"); cards.spo2.classList.add("alert");
        toast("HYPOXIA WARNING · SpO₂ falling · Check suit and cabin O₂");
        log("sys", "Simulated hypoxia event injected");
        return respond("Warning. Your blood oxygen is dropping. Check your oxygen supply and move to a safe area. Say acknowledge to dismiss.");
      case "clear_alert":
        if (!state.alert) return respond("There are no active alerts.");
        cards[state.alert].classList.remove("alert");
        state.alert = null; delete state.override.spo2; delete state.override.cardio;
        hideToast();
        return respond("Alert acknowledged. I'll keep monitoring your oxygen closely.");
      case "breathing":
        respond("Let's do a paced breathing exercise. Follow the prompts in your view.");
        return breathing();
      case "mute":
        respond("Voice muted. I'll respond in text only.", { speak: true });
        return setTimeout(() => VEGA.setMuted(true), 2200);
      case "unmute": VEGA.setMuted(false); return respond("Voice responses are back on.");
      case "help":
        return respond("Try: show my heart rate, run a full scan, status report, move panel left, hide panel, start a breathing exercise, or simulate an emergency.");
      default:
        return respond("Sorry, I didn't catch that. Try “show my heart rate” or say “help”.");
    }
  }

  /* ---------------- input wiring ---------------- */
  const CHIPS = [
    "Run a full scan", "Show my heart rate", "Status report", "Check oxygen",
    "Run a neuro scan", "Move panel left", "Move panel right", "Hide panel",
    "Show panel", "Breathing exercise", "Simulate emergency", "Acknowledge", "Help",
  ];
  $("#chips").innerHTML = CHIPS.map((c) => `<button type="button">${c}</button>`).join("");
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) execute("VEGA, " + b.textContent.toLowerCase());
  });

  $("#cmd-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    execute(v);
  });

  const listener = VEGA.createListener({
    onInterim: (t) => { input.value = t; },
    onResult: (t) => { input.value = ""; execute(t); },
    onState: (on) => {
      micBtn.classList.toggle("listening", on);
      input.placeholder = on ? "Listening…" : "Say or type “VEGA, run a full scan”…";
    },
    onError: (err) => {
      const msg = err === "not-allowed" || err === "service-not-allowed"
        ? "Microphone access was blocked. Allow mic access, or serve the site from localhost. You can still type commands."
        : err === "no-speech" ? "I didn't hear anything. Tap the mic and try again." : `Voice error: ${err}. You can type commands instead.`;
      respond(msg, { speak: false });
    },
  });

  if (!listener) $("#voice-support").textContent = "TYPE COMMANDS · VOICE N/A";

  micBtn.addEventListener("click", () => {
    if (!listener) {
      input.focus();
      return respond("Voice input isn't supported in this browser. Use Chrome or Edge, or type your command.", { speak: false });
    }
    listener.toggle();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key === "v" || e.key === "V") && document.activeElement !== input && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); micBtn.click();
    }
    if (e.key === "Escape") listener && listener.stop();
  });

  /* ---------------- field-of-view canvas ---------------- */
  const fov = $("#fov");
  const fctx = fov.getContext("2d");
  let stars = [];
  function sizeFov() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fov.width = fov.clientWidth * dpr; fov.height = fov.clientHeight * dpr;
    stars = Array.from({ length: 260 }, () => ({ x: Math.random() * fov.width, y: Math.random() * fov.height * 0.8, r: Math.random() * 1.4 * dpr + 0.2, t: Math.random() * 6 }));
  }
  function drawFov() {
    fctx.clearRect(0, 0, fov.width, fov.height);
    for (const s of stars) {
      s.t += 0.015; s.x -= 0.05; if (s.x < 0) s.x = fov.width;
      fctx.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(s.t) * 0.3})`;
      fctx.beginPath(); fctx.arc(s.x, s.y, s.r, 0, 6.283); fctx.fill();
    }
    requestAnimationFrame(drawFov);
  }
  sizeFov(); addEventListener("resize", sizeFov); drawFov();

  /* ---------------- clocks ---------------- */
  function tick() {
    TOOLS.forEach(step);
    renderVitals();
    const s = Math.floor((Date.now() - state.start) / 1000) + 3 * 86400 + 14 * 3600 + 22 * 60;
    const d = String(Math.floor(s / 86400)).padStart(3, "0");
    const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    $("#clock").innerHTML = `MET <b>${d}:${hh}:${mm}:${ss}</b>`;
  }
  tick(); setInterval(tick, 1000);
  addEventListener("resize", renderVitals);

  log("sys", "AstraSight lens online. 8 diagnostic sensors connected.");
  setTimeout(() => respond("Good morning, Commander. All diagnostics are online. Say “VEGA, help” to hear what I can do.", { speak: false }), 900);
})();
