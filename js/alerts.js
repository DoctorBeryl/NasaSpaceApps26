/* ==========================================================
   AstraSight — reading sliders, VEGA warning popups, tab sync
   Shared by the lens interface (variant "hud") and the
   diagnostics page (variant "web").
   ========================================================== */
const VegaAlerts = (() => {
  const COLORS = { crit: "rgba(255,93,115,.95)", warn: "rgba(255,198,92,.95)", ok: "rgba(77,255,176,.95)" };
  const ZONE_LABEL = { ok: "NORMAL", warn: "CAUTION", crit: "DANGER" };

  const pct = (t, v) => (((Math.min(t.max, Math.max(t.min, v)) - t.min) / (t.max - t.min)) * 100).toFixed(2) + "%";
  const stepOf = (t) => (t.decimals ? 1 / 10 ** t.decimals : 1);
  const fmt = (t, v) => Number(v).toFixed(t.decimals);

  /* Track colored by zone: danger | caution | normal | caution | danger */
  function trackGradient(t) {
    const { crit: C, warn: W, ok: O } = COLORS;
    const a = pct(t, t.critLo), b = pct(t, t.warnLo), c = pct(t, t.warnHi), d = pct(t, t.critHi);
    return `linear-gradient(90deg, ${C} 0%, ${C} ${a}, ${W} ${a}, ${W} ${b}, ${O} ${b}, ${O} ${c}, ${W} ${c}, ${W} ${d}, ${C} ${d}, ${C} 100%)`;
  }

  function sliderHTML(t, value, cls = "") {
    const lo = t.guidance && t.guidance.low ? "DANGER LOW" : "MIN";
    const hi = t.guidance && t.guidance.high ? "DANGER HIGH" : "MAX";
    return `
      <div class="vslider ${cls}" data-id="${t.id}" data-zone="${zoneOf(t, value).zone}">
        <input type="range" min="${t.min}" max="${t.max}" step="${stepOf(t)}" value="${value}"
          style="--track:${trackGradient(t)}" aria-label="${t.name} simulated reading" />
        <div class="vslider-scale"><span>${lo} · ${fmt(t, t.min)}</span><span>${fmt(t, t.max)} · ${hi}</span></div>
      </div>`;
  }

  function setSliderZone(wrap, t, v) {
    wrap.dataset.zone = zoneOf(t, v).zone;
  }

  /* ---------------- popup ---------------- */
  function createPopup({ variant = "web", mount = document.body, onShow, onReset, onPage } = {}) {
    const paged = variant === "hud";   // lens: one instruction at a time, L/R buttons to scroll
    const el = document.createElement("div");
    el.className = `vega-pop ${variant}`;
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-live", "assertive");
    el.innerHTML = `
      <div class="vp-head">
        <span class="vp-orb" aria-hidden="true"></span>
        <div class="vp-titles">
          <span class="vp-tag">VEGA · <b class="vp-sev"></b> · <span class="vp-tool"></span></span>
          <strong class="vp-title"></strong>
        </div>
        <button class="vp-x" type="button" aria-label="Dismiss">✕</button>
      </div>
      <div class="vp-reading"><span class="vp-val"></span><span class="vp-range"></span></div>
      ${paged ? `
      <div class="vp-pager">
        <button type="button" class="vp-btn vp-prev" aria-label="Previous (left lens button)">◀</button>
        <div class="vp-page" aria-live="polite">
          <div class="vp-label"></div>
          <p class="vp-card"></p>
        </div>
        <button type="button" class="vp-btn vp-next" aria-label="Next (right lens button)">▶</button>
      </div>
      <div class="vp-foot"><span class="vp-dots"></span><span class="vp-hint"></span></div>` : `
      <p class="vp-why"></p>
      <div class="vp-label">WHAT TO DO</div>
      <ol class="vp-steps"></ol>`}
      <div class="vp-actions">
        <button type="button" class="vp-ack">Acknowledge</button>
        <button type="button" class="vp-reset">Return to baseline</button>
      </div>`;
    mount.appendChild(el);

    const q = (s) => el.querySelector(s);
    const last = {};      // tool id -> last zone key seen
    let current = null;   // tool id shown
    let pages = [], page = 0;

    function hide() { el.classList.remove("show"); current = null; }

    /* ---- paged (lens) mode: one instruction per page ---- */
    function renderPage() {
      const pg = pages[page];
      const last = page === pages.length - 1;
      el.dataset.urgent = pg.urgent ? "1" : "";
      q(".vp-label").textContent = pg.label;
      q(".vp-card").textContent = pg.text;
      q(".vp-prev").disabled = page === 0;
      const nx = q(".vp-next");
      nx.textContent = last ? "✓" : "▶";
      nx.setAttribute("aria-label", last ? "Acknowledge (right lens button)" : "Next (right lens button)");
      q(".vp-dots").innerHTML = pages.map((p, i) => `<i class="${i === page ? "on" : ""}${p.urgent ? " urgent" : ""}"></i>`).join("");
      q(".vp-hint").textContent = last ? "R ✓ ACKNOWLEDGE" : `${page + 1}/${pages.length} · L ◀ ▶ R`;
      el.classList.toggle("last", last);
      const card = q(".vp-page");
      card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
    }
    /* d = +1 / -1. Returns "ack" when R is pressed on the last page. */
    function go(d) {
      if (!current || !paged) return false;
      if (d > 0 && page === pages.length - 1) { silence(); hide(); return "ack"; }   // right button on the last page = acknowledge
      const n = Math.max(0, Math.min(pages.length - 1, page + d));
      if (n === page) return false;
      page = n; renderPage();
      onPage && onPage(pages[page], page, pages.length);
      return true;
    }

    function fill(t, v, z) {
      const g = (t.guidance && t.guidance[z.side]) || {
        title: `${t.name} out of range`, why: "This reading is outside your normal range.",
        steps: ["Repeat the measurement.", "Tell a crewmate."], danger: "Notify the flight surgeon.",
      };
      el.dataset.zone = z.zone;
      q(".vp-sev").textContent = ZONE_LABEL[z.zone];
      q(".vp-tool").textContent = t.name.toUpperCase();
      q(".vp-title").textContent = g.title;
      q(".vp-val").textContent = `${fmt(t, v)} ${t.unit}`;
      q(".vp-range").textContent = `normal ${t.range}`;
      const steps = z.zone === "crit" ? [g.danger, ...g.steps] : g.steps;
      if (paged) {
        const n = g.steps.length;
        pages = steps.map((text, i) => {
          const urgent = z.zone === "crit" && i === 0;
          const k = z.zone === "crit" ? i : i + 1;
          return { text, urgent, label: urgent ? "DO THIS NOW" : `STEP ${k} OF ${n}` };
        });
        pages.push({ text: g.why, label: "WHY THIS MATTERS" });
        page = 0; renderPage();
        return g;
      }
      q(".vp-why").textContent = g.why;
      q(".vp-steps").innerHTML = "";
      steps.forEach((s, i) => {
        const li = document.createElement("li");
        if (z.zone === "crit" && i === 0) li.className = "urgent";
        li.textContent = s;
        q(".vp-steps").appendChild(li);
      });
      return g;
    }

    /* Call whenever a reading's target changes. Pops only when the zone changes. */
    function check(t, v) {
      const z = zoneOf(t, v);
      const key = z.zone + ":" + z.side;
      if (z.zone === "ok") {
        last[t.id] = key;
        if (current === t.id) hide();
        return;
      }
      if (last[t.id] !== key) {
        last[t.id] = key;
        current = t.id;
        const g = fill(t, v, z);
        el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
        onShow && onShow(t, v, z, g);
      } else if (current === t.id) {
        q(".vp-val").textContent = `${fmt(t, v)} ${t.unit}`;
      }
    }

    // Acknowledge (and ✕) stop VEGA's voice as well as closing the card.
    const silence = () => {
      if (typeof ShipPA !== "undefined" && ShipPA.ack) ShipPA.ack();
      else { if (typeof VEGA !== "undefined" && VEGA.stop) VEGA.stop(); if ("speechSynthesis" in window) speechSynthesis.cancel(); }
    };
    q(".vp-x").onclick = () => { silence(); hide(); };
    q(".vp-ack").onclick = () => { silence(); hide(); };
    q(".vp-reset").onclick = () => { const id = current; hide(); id && onReset && onReset(id); };
    if (paged) {
      q(".vp-prev").onclick = () => go(-1);
      q(".vp-next").onclick = () => go(1);
    }

    return { el, check, hide, next: () => go(1), prev: () => go(-1), get current() { return current; } };
  }

  /* Spoken summary for a popup. Caution stays friendly; danger is short and firm, with the
     crew member's name first and a steadying close, so it's pressing without sounding alarmed. */
  function speech(t, v, z, g) {
    const name = typeof Crew !== "undefined" && Crew.firstName ? Crew.firstName() : "";
    const clean = (s) => s.replace(/[“”]/g, "");
    if (z.zone === "crit") {
      return `${name ? name + ", priority alert" : "Priority alert"}. ${g.title}. ${clean(g.danger)} Do that first. I'll walk you through the rest.`;
    }
    return `Heads up${name ? ", " + name : ""}. ${g.title}. ${clean(g.steps[0])}`;
  }

  /* ---------------- cross-tab sync (lens <-> web) ---------------- */
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("astrasight-sim") : null;
  const bus = {
    send(msg) { channel && channel.postMessage(msg); },
    on(fn) { channel && channel.addEventListener("message", (e) => fn(e.data)); },
  };

  return { sliderHTML, setSliderZone, trackGradient, createPopup, speech, bus, ZONE_LABEL, fmt };
})();
