/* ==========================================================
   AstraSight — diagnostic tool demo stage
   Each tool gets a procedural signal animation. If a video exists
   at media/<tool-id>.mp4 it replaces the simulation automatically.
   ========================================================== */
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $("#demo-canvas");
  const ctx = canvas.getContext("2d");
  const video = $("#demo-video");

  let current = null;
  let playing = true;
  const overrides = {};     // tool id -> slider-set reading
  let t = 0;
  let value = 0;
  let buffer = [];
  let hits = [];            // radiation hits
  let lastFrame = performance.now();

  /* ---------------- list ---------------- */
  $("#tool-list").innerHTML = TOOLS.map((tool) => `
    <button class="tool-item" data-id="${tool.id}">
      <div class="tool-icon">${ICONS[tool.icon]}</div>
      <div><b>${tool.name}</b><span>${tool.short} · ${tool.unit}</span></div>
    </button>`).join("");
  $("#tool-list").addEventListener("click", (e) => {
    const b = e.target.closest(".tool-item");
    if (b) { history.replaceState(null, "", "#" + b.dataset.id); select(b.dataset.id); }
  });

  function select(id) {
    const tool = toolById(id) || TOOLS[0];
    current = tool;
    buffer = []; hits = []; value = tgt(tool);
    document.querySelectorAll(".tool-item").forEach((b) => b.classList.toggle("active", b.dataset.id === tool.id));
    $("#st-sensor").textContent = tool.sensor;
    $("#st-name").textContent = tool.name;
    $("#st-blurb").textContent = tool.blurb;
    $("#st-unit").textContent = tool.unit;
    $("#sp-sensor").textContent = tool.sensor;
    $("#sp-sample").textContent = tool.sample;
    $("#sp-latency").textContent = tool.latency;
    $("#sp-range").textContent = tool.range;
    $("#st-cmd").textContent = tool.cmd;
    $("#ph-file").textContent = `media/${tool.id}.mp4`;
    $("#st-steps").innerHTML = tool.steps.map(([h, p]) => `<li><span><b>${h}</b>${p}</span></li>`).join("");
    $("#sl-mount").innerHTML = VegaAlerts.sliderHTML(tool, tgt(tool), "lg");
    $("#sl-mount input").addEventListener("input", (e) => setReading(tool.id, parseFloat(e.target.value)));
    updateReadout();
    loadVideo(tool.id);
  }

  /* ---------------- reading slider + VEGA popup ---------------- */
  const tgt = (tool = current) => overrides[tool.id] ?? tool.base;
  const zone = () => zoneOf(current, tgt()).zone;

  function updateReadout() {
    const z = zoneOf(current, tgt());
    const el = $("#sl-readout");
    el.textContent = `${VegaAlerts.ZONE_LABEL[z.zone]}${z.side ? " " + z.side.toUpperCase() : ""} · ${VegaAlerts.fmt(current, tgt())} ${current.unit}`;
    el.dataset.zone = z.zone;
    const wrap = $("#sl-mount .vslider");
    if (wrap) {
      VegaAlerts.setSliderZone(wrap, current, tgt());
      if (document.activeElement !== wrap.firstElementChild) wrap.firstElementChild.value = tgt();
    }
  }

  function setReading(id, v, { broadcast = true } = {}) {
    overrides[id] = v;
    if (broadcast) VegaAlerts.bus.send({ type: "set", id, value: v });
    popup.check(toolById(id), v);
    if (current && current.id === id) updateReadout();
  }

  function resetReading(id, { broadcast = true } = {}) {
    (id ? [id] : TOOLS.map((t) => t.id)).forEach((k) => {
      delete overrides[k];
      popup.check(toolById(k), toolById(k).base);
    });
    if (broadcast) VegaAlerts.bus.send({ type: "reset", id: id || null });
    if (current) updateReadout();
  }

  const popup = VegaAlerts.createPopup({
    variant: "web",
    onShow: (t, v, z, g) => VEGA.speak(VegaAlerts.speech(t, v, z, g), { tone: VEGA.toneFor(z.zone) }),
    onReset: (id) => resetReading(id),
  });

  VegaAlerts.bus.on((m) => {
    if (m.type === "set") setReading(m.id, m.value, { broadcast: false });
    if (m.type === "reset") resetReading(m.id, { broadcast: false });
  });

  /* ---------------- optional real footage ---------------- */
  function loadVideo(id) {
    video.hidden = true;
    canvas.hidden = false;
    $("#ph-badge").hidden = false;
    $("#st-live").textContent = "LIVE SIMULATION";
    video.onloadeddata = () => {
      video.hidden = false; canvas.hidden = true; $("#ph-badge").hidden = true;
      $("#st-live").textContent = "DEMO FOOTAGE";
      video.play().catch(() => {});
    };
    video.onerror = () => {}; // keep simulation
    video.src = `media/${id}.mp4`;
  }

  /* ---------------- signal models ---------------- */
  function ecg(p) {
    // p in [0,1) beat phase -> PQRST-ish
    const g = (c, w, a) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
    return g(0.18, 0.025, 0.15) - g(0.36, 0.008, 0.18) + g(0.4, 0.012, 1) - g(0.44, 0.01, 0.3) + g(0.68, 0.045, 0.3);
  }
  function pleth(p) { return Math.max(0, Math.sin(p * Math.PI * 2)) ** 1.6 * 0.9 + Math.sin(p * Math.PI * 4 + 1) * 0.08; }

  let beatPhase = 0;
  function sample(tool, dt) {
    const a = zone() !== "ok";
    switch (tool.wave) {
      case "ecg": {
        const bpm = tool.id === "cardio" ? Math.max(20, value) : 72;
        beatPhase = (beatPhase + dt * (bpm / 60)) % 1;
        return ecg(beatPhase);
      }
      case "pleth": {
        const amp = a ? 0.45 : 1;
        return pleth((t * 1.2) % 1) * amp;
      }
      case "sine": {
        const rate = a ? 0.55 : 0.26;
        return Math.sin(t * Math.PI * 2 * rate) * (a ? 0.4 : 0.8);
      }
      case "noise": {
        const blink = (t % (a ? 1.1 : 3.4)) < 0.15 ? -0.9 : 0;
        return blink + (Math.random() - 0.5) * 0.15 + Math.sin(t * 7) * 0.08;
      }
      case "slow": return Math.sin(t * 0.4) * 0.25 + (a ? 0.5 : 0) + (Math.random() - 0.5) * 0.04;
      case "spikes": {
        if (Math.random() < (a ? 0.35 : 0.04)) hits.push({ x: 1, h: Math.random() * 0.9 + 0.1 });
        return (Math.random() - 0.5) * 0.06;
      }
      default: return 0;
    }
  }

  const ANOMALY = { cardio: 128, spo2: 89, resp: 28, neuro: 7.6, cog: 82, thermal: 38.4, rad: 6.8, hrv: 18 };

  /* ---------------- drawing ---------------- */
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function grid(w, h) {
    ctx.strokeStyle = "rgba(140,170,255,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  function color() { const z = zone(); return z === "crit" ? "#ff5d73" : z === "warn" ? "#ffc65c" : "#5ef2ff"; }

  function drawTrace(w, h) {
    const mid = h * 0.6, amp = h * 0.26;
    ctx.beginPath();
    buffer.forEach((v, i) => {
      const x = w - (buffer.length - 1 - i) * 2;
      const y = mid - v * amp;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color();
    ctx.lineWidth = 2.2;
    ctx.shadowColor = color(); ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // head dot
    if (buffer.length) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(w, mid - buffer[buffer.length - 1] * amp, 3.5, 0, 6.283); ctx.fill();
    }
  }

  function drawPupil(w, h) {
    const cx = w * 0.62, cy = h * 0.55;
    const R = Math.min(w, h) * 0.26;
    const cycle = t % 4;
    const flash = cycle < 0.15;
    // constriction curve after flash
    const k = cycle < 0.3 ? 0 : Math.exp(-(cycle - 0.3) * 1.4);
    const sluggish = zone() !== "ok" ? 0.35 : 1;
    const scale = tgt() / current.base;
    const pupil = Math.min(R * 0.95, R * scale * (0.42 - 0.22 * (1 - Math.exp(-Math.max(0, cycle - 0.3) * 6)) * k * sluggish * 1.6));
    // sclera
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.9, R * 1.05, 0, 0, 6.283);
    ctx.strokeStyle = "rgba(94,242,255,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
    // iris
    const ig = ctx.createRadialGradient(cx, cy, pupil, cx, cy, R);
    ig.addColorStop(0, "#2b4a8a"); ig.addColorStop(1, "#0d1838");
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
    ctx.strokeStyle = color(); ctx.lineWidth = 2; ctx.stroke();
    // pupil
    ctx.fillStyle = "#01030a"; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, pupil), 0, 6.283); ctx.fill();
    // tracking marks
    ctx.strokeStyle = color(); ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, pupil) + 8, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx - R * 1.3, cy); ctx.lineTo(cx - R - 6, cy); ctx.moveTo(cx + R + 6, cy); ctx.lineTo(cx + R * 1.3, cy); ctx.stroke();
    ctx.restore();
    if (flash) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(0, 0, w, h); }
    // mm readout from pupil size
    value = (pupil / (R * 0.42)) * current.base;
    // reflex graph on the left
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(flash ? "STIMULUS ●" : "REFLEX TRACKING", 20, h - 22);
  }

  function drawHits(w, h) {
    hits.forEach((p) => { p.x -= 0.004; });
    hits = hits.filter((p) => p.x > 0);
    hits.forEach((p) => {
      const x = p.x * w;
      ctx.strokeStyle = color(); ctx.lineWidth = 2; ctx.shadowColor = color(); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x, h * 0.86); ctx.lineTo(x, h * 0.86 - p.h * h * 0.5); ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (playing && current) {
      t += dt;
      const steps = 2;
      for (let i = 0; i < steps; i++) buffer.push(sample(current, dt / steps));
      const max = Math.ceil(w / 2) + 2;
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
      if (current.wave !== "pupil") {
        value += (tgt() - value) * 0.06 + (Math.random() - 0.5) * current.jitter * 0.15;
      }
    }
    ctx.clearRect(0, 0, w, h);
    grid(w, h);
    if (current) {
      if (current.wave === "pupil") drawPupil(w, h);
      else { if (current.wave === "spikes") drawHits(w, h); drawTrace(w, h); }
      $("#st-value").textContent = value.toFixed(current.decimals);
      const z = zone();
      $("#st-value").style.color = z === "crit" ? "var(--crit)" : z === "warn" ? "var(--warn)" : "";
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- controls ---------------- */
  $("#btn-play").onclick = (e) => {
    playing = !playing;
    e.currentTarget.textContent = playing ? "❚❚ Pause" : "▶ Play";
    if (!video.hidden) playing ? video.play() : video.pause();
  };
  $("#btn-anomaly").onclick = () => setReading(current.id, ANOMALY[current.id]);
  $("#btn-reset").onclick = () => resetReading(current.id);
  $("#btn-speak").onclick = () => {
    const z = zone();
    const v = `${value.toFixed(current.decimals)} ${current.unit}`;
    VEGA.setMuted(false);
    VEGA.speak(z === "ok"
      ? `${current.name}: ${v}. That's within your normal range.`
      : z === "crit"
        ? `Priority alert. ${current.name} is at ${v}, well outside your normal range. Contact the flight surgeon now. I'm watching your numbers.`
        : `Heads up. ${current.name} is at ${v}, outside your normal range. Take it easy, and tell the flight surgeon if it doesn't settle.`,
      { tone: VEGA.toneFor(z) });
  };

  addEventListener("resize", resize);
  addEventListener("hashchange", () => select(location.hash.slice(1)));
  resize();
  select(location.hash.slice(1));
  requestAnimationFrame(frame);
})();
