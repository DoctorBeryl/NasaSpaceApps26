/* ==========================================================
   AstraSight: guided ultrasound (ultrasound.html)
   A VULCAN / EchoFinder-style concept: the crew member moves the
   probe, ASTRA compares its position, turn and tilt with a stored
   target for the organ, and gives one instruction at a time. The
   image sharpens as the probe lines up; a clear frame is saved and
   queued for the flight surgeon (MedLink delay).
   Everything here is simulated: the probe follows the mouse or keys,
   and the scan image is generated, not real.
   Body coordinates are in cm on a 40 x 64 cm torso, seen from the
   front: x = 0 is the patient's right side, y = 0 is the neck.
   ========================================================== */
(function () {
  const W_CM = 40, H_CM = 64;
  const CLEAR = 0.8;             // quality needed for a usable frame
  const HOLD_MS = 1200;          // hold that long to auto-save
  // js/vega.js declares `const VEGA`: a global binding, but not a window property, so
  // `window.VEGA` is always undefined. Check the binding itself.
  const hasVoice = () => typeof VEGA !== "undefined" && typeof VEGA.speak === "function";

  // rot: probe long axis vs the body's head-feet line, degrees clockwise on screen.
  // tilt: beam angle, positive = beam aimed toward the feet.
  const ORGANS = {
    kidney: {
      label: "Right kidney", x: 6, y: 37, rot: -30, tilt: -10,
      where: "Right flank, mid-axillary line, just under the ribs",
      why: "Kidney stones are a known spaceflight risk: bone loss raises the calcium in urine.",
    },
    heart: {
      label: "Heart", x: 23.5, y: 21, rot: -60, tilt: 0,
      where: "Left of the breastbone, fourth rib space",
      why: "Checks heart size and pumping, which change as fluid shifts toward the head.",
    },
    lungs: {
      label: "Lungs", x: 12, y: 11, rot: 0, tilt: 0,
      where: "Upper chest on the right, below the collarbone",
      why: "Watching the lung slide against the chest wall rules out a collapsed lung.",
    },
    bladder: {
      label: "Bladder", x: 20, y: 58, rot: 90, tilt: 15,
      where: "Just above the pubic bone, probe across the body",
      why: "Checks for urine retention, which is common in the first days of flight.",
    },
  };

  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#00f0ff";

  const state = {
    organ: "kidney",
    probe: { x: 20, y: 30, rot: 0, tilt: 0 },
    q: 0, guide: null, clearSince: 0, lastSaveKey: "",
    voice: false, lastSpoken: "", lastSpokenAt: 0,
    captures: [], showTarget: true,
  };

  /* ---------------- guidance ---------------- */
  const wrap = (d) => ((d + 540) % 360) - 180;

  function assess() {
    const t = ORGANS[state.organ], p = state.probe;
    const dx = t.x - p.x, dy = t.y - p.y, dist = Math.hypot(dx, dy);
    const dr = wrap(t.rot - p.rot), dt = t.tilt - p.tilt;
    const ep = dist / 3.2, er = Math.abs(dr) / 25, et = Math.abs(dt) / 10;   // errors in "tolerance units"
    const q = Math.exp(-ep * ep) * Math.exp(-er * er) * Math.exp(-et * et);

    let kind, text;
    if (q >= CLEAR) { kind = "hold"; text = "Hold still. The image is clear."; }
    else if (ep >= er && ep >= et) {
      kind = "move";
      const parts = [];
      if (Math.abs(dy) >= 1) parts.push(`${Math.round(Math.abs(dy))} cm toward the ${dy < 0 ? "head" : "feet"}`);
      if (Math.abs(dx) >= 1) parts.push(`${Math.round(Math.abs(dx))} cm to the patient's ${dx < 0 ? "right" : "left"}`);
      text = parts.length ? `Slide the probe ${parts.join(" and ")}.` : "Slide the probe a little closer to the target.";
    } else if (er >= et) {
      kind = "turn";
      text = `Turn the probe ${dr > 0 ? "clockwise" : "counterclockwise"} about ${Math.max(5, Math.round(Math.abs(dr) / 5) * 5)}°.`;
    } else {
      kind = "tilt";
      text = `Tilt the beam toward the ${dt > 0 ? "feet" : "head"} about ${Math.max(2, Math.round(Math.abs(dt)))}°.`;
    }
    state.q = q;
    state.guide = { kind, text, dx, dy, dr, dt };
  }

  /* ---------------- body view ---------------- */
  const body = $("us-body"), bctx = body.getContext("2d");
  let scale = 1, ox = 0, oy = 0;   // cm -> px

  function sizeBody() {
    const r = body.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    body.width = Math.round(r.width * dpr); body.height = Math.round(r.height * dpr);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min((r.width - 40) / W_CM, (r.height - 30) / H_CM);
    ox = (r.width - W_CM * scale) / 2; oy = (r.height - H_CM * scale) / 2 + 4;
  }
  const px = (x, y) => [ox + x * scale, oy + y * scale];

  function torsoPath(c) {
    // Simple front torso: neck, shoulders, waist, hips (cm coordinates).
    const pts = [[15, -3], [15, 0], [3, 3], [0, 9], [1, 30], [4, 42], [3, 52], [5, 64], [35, 64], [37, 52], [36, 42], [39, 30], [40, 9], [37, 3], [25, 0], [25, -3]];
    c.beginPath();
    pts.forEach(([x, y], i) => { const [X, Y] = px(x, y); i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
    c.closePath();
  }

  function drawProbe(c, p, { ghost = false, color }) {
    const [X, Y] = px(p.x, p.y);
    c.save();
    c.translate(X, Y);
    c.rotate((p.rot * Math.PI) / 180);
    const w = 1.6 * scale, h = 6 * scale;
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, 4);
    if (ghost) {
      c.setLineDash([5, 4]); c.lineWidth = 1.5; c.strokeStyle = color; c.stroke();
    } else {
      c.globalAlpha = 0.2; c.fillStyle = color; c.fill(); c.globalAlpha = 1;
      c.lineWidth = 2; c.strokeStyle = color; c.stroke();
    }
    // Orientation notch at the head end of the probe.
    c.beginPath(); c.arc(0, -h / 2 - 4, 2.6, 0, Math.PI * 2);
    c.fillStyle = color; c.fill();
    c.restore();
  }

  function drawBody() {
    const r = body.getBoundingClientRect(), c = bctx;
    c.clearRect(0, 0, r.width, r.height);
    const cyan = css("--cyan"), dim = css("--text-faint"), line = css("--border");

    torsoPath(c);
    c.fillStyle = "rgba(0, 240, 255, 0.035)"; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = dim; c.stroke();

    // Landmarks: collarbones, breastbone, rib arcs, navel.
    c.strokeStyle = line; c.lineWidth = 1;
    c.beginPath(); c.moveTo(...px(4, 4)); c.quadraticCurveTo(...px(12, 2), ...px(19, 5)); c.stroke();
    c.beginPath(); c.moveTo(...px(36, 4)); c.quadraticCurveTo(...px(28, 2), ...px(21, 5)); c.stroke();
    c.beginPath(); c.moveTo(...px(20, 6)); c.lineTo(...px(20, 27)); c.stroke();
    for (let i = 0; i < 6; i++) {
      const y = 9 + i * 4;
      c.beginPath(); c.moveTo(...px(19, y)); c.quadraticCurveTo(...px(8, y + 1), ...px(3 + i * 0.4, y + 5)); c.stroke();
      c.beginPath(); c.moveTo(...px(21, y)); c.quadraticCurveTo(...px(32, y + 1), ...px(37 - i * 0.4, y + 5)); c.stroke();
    }
    c.beginPath(); c.arc(...px(20, 44), 2, 0, Math.PI * 2); c.stroke();

    c.fillStyle = dim; c.font = "11px Inter, sans-serif"; c.textAlign = "center";
    c.fillText("Patient's right", ...px(4, -1.5));
    c.fillText("Patient's left", ...px(36, -1.5));

    const t = ORGANS[state.organ], qColor = state.q >= CLEAR ? css("--ok") : state.q >= 0.4 ? css("--warn") : cyan;
    if (state.showTarget) {
      drawProbe(c, t, { ghost: true, color: css("--amber") });
      if (state.q < CLEAR) {
        c.setLineDash([2, 5]); c.strokeStyle = css("--amber"); c.lineWidth = 1;
        c.beginPath(); c.moveTo(...px(state.probe.x, state.probe.y)); c.lineTo(...px(t.x, t.y)); c.stroke(); c.setLineDash([]);
      }
    }
    drawProbe(c, state.probe, { color: qColor });
  }

  /* ---------------- scan image ---------------- */
  const scan = $("us-scan"), sctx = scan.getContext("2d");
  const SW = 160, SH = 120, APEX_X = 80, APEX_Y = 4, R0 = 4, R1 = 116, HALF = (38 * Math.PI) / 180;
  const buf = document.createElement("canvas"); buf.width = SW; buf.height = SH;
  const bufCtx = buf.getContext("2d"), img = bufCtx.createImageData(SW, SH);

  // Organ echo models in local image coordinates (u: lateral px, v: depth px).
  // Return null for "no organ here", else a brightness 0..1.
  const MODELS = {
    kidney(u, v) {
      if (v < 30) return 0.42;                                    // liver above: even mid-grey
      const e = (u / 38) ** 2 + ((v - 62) / 18) ** 2;
      if (Math.abs(e - 1) < 0.13) return 0.95;                    // bright capsule
      if (e < 0.22) return 0.8;                                   // central sinus fat
      if (e < 1) return 0.2;                                      // darker cortex
      return null;
    },
    heart(u, v) {
      const cz = 62, outer = (u / 40) ** 2 + ((v - cz) / 42) ** 2;
      if (outer > 1) return null;
      for (const [cu, cv, a, b] of [[-14, -15, 12, 14], [14, -15, 12, 14], [-14, 17, 11, 12], [14, 17, 11, 12]]) {
        if (((u - cu) / a) ** 2 + ((v - cz - cv) / b) ** 2 < 1) return 0.04;   // blood-filled chambers
      }
      return 0.72;                                                // muscle walls and septum
    },
    lungs(u, v) {
      // "Bat sign": two ribs with shadows, the pleural line between them.
      for (const ru of [-15, 15]) {
        if (Math.abs(u - ru) < 6) {
          if (Math.abs(v - 21) < 1.8) return 1;                   // rib surface
          if (v > 22) return 0.03;                                // rib shadow
        }
      }
      if (Math.abs(v - 26) < 1.6 && Math.abs(u) < 10) return 1;   // pleural line
      if (Math.abs(v - 52) < 1.3) return 0.55;                    // A-line
      if (Math.abs(v - 78) < 1.2) return 0.32;                    // A-line
      return v > 26 ? 0.14 : null;
    },
    bladder(u, v) {
      const inside = Math.abs(u) < 30 && Math.abs(v - 52) < 20;
      const wall = Math.abs(u) < 33 && Math.abs(v - 52) < 23;
      if (inside) return 0.03;                                    // urine: black
      if (wall) return 0.9;
      if (Math.abs(u) < 30 && v > 75) return 0.62;                // brighter tissue behind fluid
      return null;
    },
  };

  function renderScan() {
    const g = state.guide, q = state.q, model = MODELS[state.organ];
    const vis = Math.max(0, Math.min(1, (q - 0.08) / 0.77));
    // A misaligned probe sees the organ off-center, rotated and at the wrong depth.
    const offU = Math.max(-90, Math.min(90, -(g.dx * 6 + g.dy * 2.5)));
    const offV = Math.max(-40, Math.min(40, g.dt * 1.6));
    const ang = (g.dr * 0.9 * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const d = img.data;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const i = (y * SW + x) * 4, rx = x - APEX_X, ry = y - APEX_Y, r = Math.hypot(rx, ry), th = Math.atan2(rx, ry);
        if (r < R0 || r > R1 || Math.abs(th) > HALF) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255; continue; }
        const z = (r - R0) / (R1 - R0), atten = 1 - 0.55 * z;
        const s = Math.random(), speckle = s * s * 1.6;
        let v = 0.3 * speckle;
        if (vis > 0) {
          const u0 = rx - offU, v0 = y - offV, u = u0 * ca - (v0 - 60) * sa, w = u0 * sa + (v0 - 60) * ca + 60;
          const o = model(u, w);
          if (o !== null) v = v * (1 - vis) + o * (0.55 + 0.6 * speckle) * vis;
        }
        const out = Math.max(0, Math.min(255, v * atten * 255));
        d[i] = out; d[i + 1] = out; d[i + 2] = Math.min(255, out * 1.04); d[i + 3] = 255;
      }
    }
    bufCtx.putImageData(img, 0, 0);

    const r = scan.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (scan.width !== Math.round(r.width * dpr)) { scan.width = Math.round(r.width * dpr); scan.height = Math.round(r.height * dpr); }
    const c = sctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#000"; c.fillRect(0, 0, r.width, r.height);
    const k = Math.min(r.width / SW, (r.height - 24) / SH), w = SW * k, h = SH * k, X = (r.width - w) / 2, Y = 18;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.drawImage(buf, X, Y, w, h);

    // Depth scale (16 cm field) and labels.
    c.fillStyle = "rgba(216, 232, 244, 0.7)"; c.font = "10px JetBrains Mono, monospace"; c.textAlign = "left";
    for (let cm = 0; cm <= 16; cm += 4) { const yy = Y + (R0 + (cm / 16) * (R1 - R0)) * k; c.fillRect(X + w - 10, yy, 6, 1); c.fillText(String(cm), X + w - 2, yy + 3); }
    c.fillText(`${ORGANS[state.organ].label}  ${Math.round(q * 100)}%`, X + 4, 12);
    c.textAlign = "right"; c.fillText("simulated", r.width - 6, 12);
  }

  /* ---------------- UI ---------------- */
  const guideEl = $("us-guide"), meter = $("us-meter"), qEl = $("us-q"), live = $("us-live");
  let lastLive = 0;

  function updateText() {
    const g = state.guide, q = state.q;
    guideEl.textContent = g.text;
    guideEl.dataset.zone = q >= CLEAR ? "ok" : q >= 0.4 ? "warn" : "far";
    meter.style.width = `${Math.round(q * 100)}%`;
    meter.dataset.zone = guideEl.dataset.zone;
    qEl.textContent = `${Math.round(q * 100)}%`;
    const now = performance.now();
    if (now - lastLive > 2000 || g.kind === "hold") { live.textContent = g.text; lastLive = now; }
    if (state.voice && hasVoice() && g.text !== state.lastSpoken && now - state.lastSpokenAt > 3500) {
      state.lastSpoken = g.text; state.lastSpokenAt = now;
      VEGA.speak(g.text, { tone: "calm", cache: true });   // ASTRA voice; repeated phrases replay from cache
    }
  }

  function autoSave() {
    if (!$("us-auto").checked) return;
    const now = performance.now();
    if (state.q < CLEAR) { state.clearSince = 0; return; }
    if (!state.clearSince) state.clearSince = now;
    const key = `${state.organ}:${Math.round(state.probe.x)}:${Math.round(state.probe.y)}:${Math.round(state.probe.rot / 10)}`;
    if (now - state.clearSince > HOLD_MS && key !== state.lastSaveKey) { state.lastSaveKey = key; capture(true); }
  }

  function capture(auto) {
    const t = ORGANS[state.organ];
    state.captures.unshift({ organ: t.label, q: state.q, at: new Date(), src: scan.toDataURL("image/jpeg", 0.8), status: "saved", auto });
    state.captures = state.captures.slice(0, 8);
    renderCaptures();
    if (state.voice && hasVoice()) VEGA.speak(`${t.label} image saved.`, { tone: "calm", cache: true });
  }

  function renderCaptures() {
    const list = $("us-captures");
    if (!state.captures.length) {
      list.innerHTML = `<p class="dim us-empty">No images yet. Line up the probe and hold it still, or press Save image.</p>`;
    } else {
      list.innerHTML = state.captures.map((c, i) => `
        <figure class="us-shot" data-status="${c.status}">
          <img src="${c.src}" alt="${c.organ} scan, ${Math.round(c.q * 100)}% quality" />
          <figcaption><b>${c.organ}</b><span>${Math.round(c.q * 100)}% · ${c.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}${c.auto ? " · auto" : ""}</span><span class="us-status">${c.label || (c.q >= CLEAR ? "Ready to send" : "Low quality")}</span></figcaption>
        </figure>`).join("");
    }
    const unsent = state.captures.filter((c) => c.status === "saved").length;
    $("us-send").disabled = !unsent;
    $("us-send").textContent = unsent ? `Send ${unsent} image${unsent > 1 ? "s" : ""} to the flight surgeon` : "Send to the flight surgeon";
  }

  function sendAll() {
    const batch = state.captures.filter((c) => c.status === "saved");
    if (!batch.length) return;
    batch.forEach((c) => { c.status = "sending"; });
    MedLink.send({
      onTick(left) { batch.forEach((c) => { c.label = `Reaches Earth in ${MedLink.fmt(left)}`; }); renderCaptures(); },
      onArrive() {
        batch.forEach((c) => { c.status = "delivered"; c.label = "Delivered to the flight surgeon"; });
        renderCaptures();
        $("us-link-note").textContent = `Delivered. A reply takes at least another ${MedLink.fmt(MedLink.mission.delay)} to come back.`;
      },
    });
  }

  function setOrgan(id) {
    state.organ = id;
    state.probe = { x: 20, y: 30, rot: 0, tilt: 0 };
    state.clearSince = 0; state.lastSaveKey = "";
    document.querySelectorAll("#us-organs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.organ === id)));
    $("us-where").textContent = ORGANS[id].where;
    $("us-why").textContent = ORGANS[id].why;
    syncSliders(); frame(true);
  }

  function syncSliders() {
    $("us-rot").value = Math.round(state.probe.rot); $("us-rot-v").textContent = `${Math.round(state.probe.rot)}°`;
    $("us-tilt").value = Math.round(state.probe.tilt);
    const t = Math.round(state.probe.tilt);
    $("us-tilt-v").textContent = t === 0 ? "straight down" : `${Math.abs(t)}° toward the ${t > 0 ? "feet" : "head"}`;
  }

  function moveTo(x, y) {
    state.probe.x = Math.max(0, Math.min(W_CM, x));
    state.probe.y = Math.max(0, Math.min(H_CM, y));
  }

  /* pointer: drag anywhere on the body to place the probe; wheel turns it */
  let dragging = false;
  function pointerCm(e) { const r = body.getBoundingClientRect(); return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale]; }
  body.addEventListener("pointerdown", (e) => { dragging = true; body.setPointerCapture(e.pointerId); moveTo(...pointerCm(e)); frame(true); });
  body.addEventListener("pointermove", (e) => { if (dragging) { moveTo(...pointerCm(e)); frame(true); } });
  body.addEventListener("pointerup", () => { dragging = false; });
  body.addEventListener("wheel", (e) => { e.preventDefault(); state.probe.rot = wrap(state.probe.rot + Math.sign(e.deltaY) * 5); syncSliders(); frame(true); }, { passive: false });
  body.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 2 : 0.5, p = state.probe;
    const keys = {
      ArrowLeft: () => moveTo(p.x - step, p.y), ArrowRight: () => moveTo(p.x + step, p.y),
      ArrowUp: () => moveTo(p.x, p.y - step), ArrowDown: () => moveTo(p.x, p.y + step),
      q: () => { p.rot = wrap(p.rot - 5); }, e: () => { p.rot = wrap(p.rot + 5); },
      w: () => { p.tilt = Math.max(-30, p.tilt - 2); }, s: () => { p.tilt = Math.min(30, p.tilt + 2); },
    };
    const fn = keys[e.key] || keys[e.key.toLowerCase()];
    if (fn) { e.preventDefault(); fn(); syncSliders(); frame(true); }
  });

  $("us-rot").addEventListener("input", (e) => { state.probe.rot = Number(e.target.value); syncSliders(); frame(true); });
  $("us-tilt").addEventListener("input", (e) => { state.probe.tilt = Number(e.target.value); syncSliders(); frame(true); });
  $("us-organs").addEventListener("click", (e) => { const b = e.target.closest("button[data-organ]"); if (b) setOrgan(b.dataset.organ); });
  $("us-save").addEventListener("click", () => capture(false));
  $("us-send").addEventListener("click", sendAll);
  $("us-target").addEventListener("change", (e) => { state.showTarget = e.target.checked; frame(true); });
  $("us-reset").addEventListener("click", () => setOrgan(state.organ));
  $("us-voice").addEventListener("click", (e) => {
    state.voice = !state.voice;
    e.currentTarget.setAttribute("aria-pressed", String(state.voice));
    e.currentTarget.textContent = state.voice ? "Voice guidance: on" : "Voice guidance: off";
    if (state.voice) { state.lastSpoken = ""; state.lastSpokenAt = 0; if (hasVoice()) VEGA.speak("Voice guidance on.", { tone: "calm", cache: true }); } else if (hasVoice() && VEGA.stop) VEGA.stop();
  });

  MedLink.mountPicker($("us-mission"));
  const showLink = () => { $("us-link-note").textContent = MedLink.mission.note; };
  MedLink.onChange(showLink); showLink();

  /* ---------------- loop ---------------- */
  let lastFrame = 0;
  function frame(force) {
    assess(); drawBody(); updateText(); autoSave();
    if (force || !reduceMotion) renderScan();
  }
  function loop(ts) {
    if (!document.hidden && ts - lastFrame > 70) { lastFrame = ts; frame(false); }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => { sizeBody(); frame(true); });
  sizeBody();
  setOrgan("kidney");
  renderCaptures();
  requestAnimationFrame(loop);

  window.AstraUltrasound = { ORGANS, state, setOrgan, assess, capture };   // for tests and the console
})();
