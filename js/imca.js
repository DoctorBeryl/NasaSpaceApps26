/* ==========================================================
   AstraSight: IMCA, the Intelligent Medical Crew Assistant (imca.html)
   Walks the crew medical officer through a consult in five steps:
   complaint, questions (OPQRST plus red flags), vitals, ASTRA's
   assessment (/api/ai/triage on MedGemma), and a note for the flight
   surgeon (SOAP format, sent with the MedLink delay).
   Red flags and the escalation decision are made in code. The model
   only adds possible causes, what to do, and what to check.
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const COMPLAINTS = ["Headache", "Eye or vision problem", "Back pain", "Nausea or vomiting", "Ear pain", "Ankle or joint injury",
    "Skin rash or irritation", "Belly or side pain", "Cough or trouble breathing", "Chest pain", "Other"];
  const QUALITIES = ["Sharp", "Dull or aching", "Burning", "Throbbing", "Cramping", "Pressure", "Itching", "Numb or tingling"];
  const RED_FLAGS = ["Chest pain or pressure", "Trouble breathing", "Confusion or slurred speech", "Sudden vision loss",
    "Fainted or nearly fainted", "Numbness or weakness on one side", "Fever above 38.5 °C", "Severe pain that started suddenly"];
  // Complaints that always go to the flight surgeon, whatever the answers.
  const SERIOUS = new Set(["Chest pain", "Cough or trouble breathing"]);

  const VITALS = [
    { id: "cardio", label: "Heart rate" },
    { id: "spo2", label: "Blood oxygen" },
    { id: "thermal", label: "Temperature" },
    { id: "resp", label: "Breathing rate" },
  ];
  const tool = (id) => TOOLS.find((t) => t.id === id);

  const STEPS = ["Complaint", "Questions", "Vitals", "Assessment", "Note for the flight surgeon"];
  const state = {
    step: 0, reached: 0,
    patient: "", complaint: "", words: "",
    onset: "", betterWorse: "", quality: new Set(), where: "", severity: 3, trend: "About the same",
    flags: new Set(), vitals: {}, bp: "118/76",
    result: null, error: "", loading: false, req: null,
  };

  /* ---------------- helpers ---------------- */
  async function api(path, body, signal) {
    const headers = { "Content-Type": "application/json" };
    if (window.AstraAuth && AstraAuth.getIdToken) {
      const t = await AstraAuth.getIdToken().catch(() => null);
      if (t) headers.Authorization = "Bearer " + t;
    }
    const r = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.message || `the server answered ${j.status || r.status}`);   // j.error: failed after the keep-alive (server/ai.js)
    return j;
  }

  function level() {
    if (state.flags.size || SERIOUS.has(state.complaint)) return "critical";
    if (state.severity >= 7 || state.trend === "Getting worse") return "caution";
    return "low";
  }

  function reportText() {
    const trim = (s) => s.replace(/[\s.!?]+$/, "");
    return [
      `Consult for ${state.patient || "a crew member"}. Complaint: ${state.complaint || "not given"}.`,
      state.words && `In their words: ${trim(state.words)}.`,
      `Onset: ${state.onset || "not recorded"}.`,
      state.onset === "During or after an EVA" ? "" : "Setting: inside the spacecraft, not in a suit.",
      state.betterWorse && `Better or worse with: ${trim(state.betterWorse)}.`,
      state.quality.size && `Feels: ${[...state.quality].join(", ").toLowerCase()}.`,
      state.where && `Where: ${trim(state.where)}.`,
      `Severity ${state.severity}/10, ${state.trend.toLowerCase()}.`,
      `Red flags: ${state.flags.size ? [...state.flags].join(", ").toLowerCase() : "none"}.`,
    ].filter(Boolean).join(" ");
  }

  function vitalsLine() {
    return VITALS.map((v) => `${tool(v.id).short} ${state.vitals[v.id]} ${tool(v.id).unit}`).concat(`BP ${state.bp} mmHg`).join(", ");
  }

  /* ---------------- rail ---------------- */
  function renderRail() {
    $("imca-rail").innerHTML = STEPS.map((s, i) => `
      <li><button type="button" data-step="${i}" ${i > state.reached ? "disabled" : ""} aria-current="${i === state.step ? "step" : "false"}">
        <span class="imca-num">${i + 1}</span><span>${s}</span></button></li>`).join("");
  }
  $("imca-rail").addEventListener("click", (e) => { const b = e.target.closest("button[data-step]"); if (b) go(Number(b.dataset.step)); });

  function go(i, focus = true) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, i));
    state.reached = Math.max(state.reached, state.step);
    document.querySelectorAll(".imca-step").forEach((el, k) => { el.hidden = k !== state.step; });
    renderRail();
    $("imca-back").hidden = state.step === 0;
    $("imca-next").hidden = state.step === STEPS.length - 1;
    $("imca-next").textContent = state.step === 2 ? "Get ASTRA's assessment" : state.step === 3 ? "Write the note" : "Next";
    validate();
    if (state.step === 3 && !state.result && !state.loading) assess();
    if (state.step === 4) $("imca-note").value = note();
    const h = document.querySelector(`.imca-step[data-i="${state.step}"] h2`);
    if (h && focus) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  $("imca-back").addEventListener("click", () => go(state.step - 1));
  $("imca-next").addEventListener("click", () => go(state.step + 1));

  function validate() {
    const ok = state.step !== 0 || !!state.complaint;
    $("imca-next").disabled = !ok;
    $("imca-need").hidden = ok;
  }

  /* ---------------- step 1: complaint ---------------- */
  function chips(el, items, { multi, selected, onPick }) {
    el.innerHTML = items.map((c) => `<button type="button" class="med-chip" aria-pressed="${multi ? selected.has(c) : selected() === c}">${esc(c)}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".med-chip"); if (!b) return;
      onPick(b.textContent);
      el.querySelectorAll(".med-chip").forEach((x) => x.setAttribute("aria-pressed", String(multi ? selected.has(x.textContent) : selected() === x.textContent)));
    });
  }
  chips($("imca-complaints"), COMPLAINTS, {
    selected: () => state.complaint,
    onPick: (c) => { state.complaint = c; state.result = null; validate(); renderFlagBanner(); },
  });
  $("imca-patient").addEventListener("input", (e) => { state.patient = e.target.value.trim(); });
  $("imca-words").addEventListener("input", (e) => { state.words = e.target.value.trim(); state.result = null; });

  /* ---------------- step 2: questions ---------------- */
  chips($("imca-quality"), QUALITIES, {
    multi: true, selected: state.quality,
    onPick: (q) => { state.quality.has(q) ? state.quality.delete(q) : state.quality.add(q); state.result = null; },
  });
  $("imca-flags").innerHTML = RED_FLAGS.map((f, i) => `<label class="med-check imca-flag"><input type="checkbox" value="${i}" /> ${esc(f)}</label>`).join("");
  $("imca-flags").addEventListener("change", (e) => {
    const f = RED_FLAGS[Number(e.target.value)];
    e.target.checked ? state.flags.add(f) : state.flags.delete(f);
    state.result = null; renderFlagBanner();
  });
  const bind = (id, key, after) => $(id).addEventListener("input", (e) => { state[key] = e.target.value; state.result = null; after && after(); });
  bind("imca-onset", "onset");
  bind("imca-bw", "betterWorse");
  bind("imca-where", "where");
  bind("imca-trend", "trend");
  bind("imca-sev", "severity", () => { state.severity = Number(state.severity); $("imca-sev-v").textContent = `${state.severity} / 10`; });

  function renderFlagBanner() {
    const el = $("imca-flag-banner");
    el.hidden = level() !== "critical";
    el.textContent = state.flags.size
      ? `Red flag: ${[...state.flags].join(", ").toLowerCase()}. Contact the flight surgeon now. Keep going with IMCA while you wait.`
      : `${state.complaint} always goes to the flight surgeon. Contact them now and keep going with IMCA while you wait.`;
  }

  /* ---------------- step 3: vitals ---------------- */
  function sample() {
    VITALS.forEach((v) => {
      const t = tool(v.id);
      state.vitals[v.id] = Number((t.base + (Math.random() * 2 - 1) * t.jitter * 2).toFixed(t.decimals));
    });
    state.bp = `${112 + Math.round(Math.random() * 14)}/${70 + Math.round(Math.random() * 10)}`;
  }
  function renderVitals() {
    $("imca-vitals").innerHTML = VITALS.map((v) => {
      const t = tool(v.id), zone = window.zoneOf ? zoneOf(t, state.vitals[v.id]) : "ok";
      return `<label class="imca-vital" data-zone="${zone}"><span>${v.label}</span>
        <span class="imca-vital-in"><input type="number" step="${t.decimals ? 0.1 : 1}" data-id="${v.id}" value="${state.vitals[v.id]}" /> <em>${t.unit}</em></span>
        <small>Normal ${t.warnLo}–${t.warnHi > t.max ? t.max : t.warnHi} ${t.unit}</small></label>`;
    }).join("") + `<label class="imca-vital" data-zone="ok"><span>Blood pressure</span>
        <span class="imca-vital-in"><input type="text" id="imca-bp" value="${state.bp}" inputmode="numeric" /> <em>mmHg</em></span><small>Measured with the cuff</small></label>`;
  }
  $("imca-vitals").addEventListener("change", (e) => {
    const id = e.target.dataset.id;
    if (id) state.vitals[id] = Number(e.target.value);
    if (e.target.id === "imca-bp") state.bp = e.target.value.trim();
    state.result = null; renderVitals();
  });
  $("imca-remeasure").addEventListener("click", () => { sample(); state.result = null; renderVitals(); });

  /* ---------------- step 4: assessment ---------------- */
  async function assess() {
    if (state.req) state.req.abort();
    state.req = new AbortController();
    state.loading = true; state.error = ""; renderAssessment();
    try {
      state.result = await api("/api/ai/triage", {
        report: reportText(),
        level: level(),
        flag: state.flags.size ? `Red flags: ${[...state.flags].join(", ")}` : undefined,
        vitals: { ...state.vitals },
        context: { "Blood pressure": `${state.bp} mmHg`, Source: "IMCA consult" },
      }, state.req.signal);
    } catch (e) {
      if (e.name === "AbortError") return;
      state.result = null;
      state.error = e.message === "Failed to fetch" ? "the AstraSight server isn't running" : e.message;
    }
    state.loading = false; renderAssessment();
  }
  $("imca-retry").addEventListener("click", assess);

  function renderAssessment() {
    const out = $("imca-assessment"), j = state.result, mustEscalate = level() === "critical";
    $("imca-read").hidden = !j;
    if (state.loading) {
      out.innerHTML = `<p class="dim pulse">ASTRA is reviewing the consult. The first run can take a minute while the medical model loads.</p>`;
      return;
    }
    if (!j) {
      out.innerHTML = `<div class="imca-offline"><p><strong>ASTRA's medical model didn't answer:</strong> ${esc(state.error)}.</p>
        <p class="dim">Start it with <span class="mono">node server.js</span> and Ollama (<span class="mono">ollama pull medgemma1.5:4b</span>), then press Ask again. You can still write the note and send it to the flight surgeon.</p>
        ${mustEscalate ? `<p class="imca-escalate">Red flag in this consult: contact the flight surgeon now.</p>` : ""}</div>`;
      return;
    }
    const escalate = j.escalate || mustEscalate;
    out.innerHTML = `
      ${escalate ? `<p class="imca-escalate">Escalate: contact the flight surgeon now.</p>` : ""}
      ${j.summary ? `<p class="imca-summary">${esc(j.summary)}</p>` : ""}
      <h3>Possible causes to consider</h3>
      <ol class="imca-causes">${(j.possibleCauses || []).map((c) => `
        <li><div class="imca-cause-head"><strong>${esc(c.name)}</strong><span class="imca-like" data-like="${esc(c.likelihood)}">${esc(c.likelihood)}</span></div>
        <p class="dim">${esc(c.why)}</p>
        ${(c.whatToDo || []).length ? `<p class="imca-todo-h">What to do</p><ul class="imca-todo">${c.whatToDo.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</li>`).join("")}
      </ol>
      ${(j.checkNext || []).length ? `<h3>Check or record next</h3><ul class="imca-todo">${j.checkNext.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="med-fine">${esc(j.disclaimer || "AI suggestion, not a diagnosis.")} Model: ${esc(j.model || "unknown")}${j.fallback ? " (MedGemma not installed, general model used)" : ""}.</p>`;
  }

  $("imca-read").addEventListener("click", () => {
    const j = state.result; if (!j || !window.VEGA) return;
    const top = (j.possibleCauses || [])[0];
    const text = [j.escalate || level() === "critical" ? "Contact the flight surgeon now." : "",
      j.summary, top ? `Most likely to consider: ${top.name}. ${(top.whatToDo || []).join(" ")}` : ""].filter(Boolean).join(" ");
    VEGA.speak(text, { tone: j.escalate ? "urgent" : "calm" });
  });

  /* ---------------- step 5: note and follow-up ---------------- */
  function note() {
    const j = state.result, now = new Date();
    const causes = j ? (j.possibleCauses || []).map((c, i) => `  ${i + 1}. ${c.name} (${c.likelihood}): ${c.why}`).join("\n") : "  ASTRA's medical model was offline. No AI assessment.";
    const top = j && (j.possibleCauses || [])[0];
    const plan = [
      ...(top ? (top.whatToDo || []).map((x) => `  - ${x}`) : []),
      ...(j ? (j.checkNext || []).map((x) => `  - Check: ${x}`) : []),
      level() === "critical" || (j && j.escalate) ? "  - Escalated to the flight surgeon." : "  - Review at the next medical conference.",
    ].join("\n");
    return [
      `CONSULT NOTE (AstraSight IMCA)`,
      `Time: ${now.toISOString().replace("T", " ").slice(0, 16)} UTC    Mission: ${MedLink.mission.label}`,
      `Patient: ${state.patient || "not recorded"}`,
      ``,
      `S (what they report): ${reportText()}`,
      ``,
      `O (measured): ${vitalsLine()}.`,
      ``,
      `A (ASTRA suggestion, not a diagnosis):`,
      causes,
      ``,
      `P (done or planned):`,
      plan,
      ``,
      `Simulated data. Concept prototype, not a medical device.`,
    ].join("\n");
  }

  $("imca-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("imca-note").value); $("imca-copy").textContent = "Copied"; }
    catch { $("imca-note").select(); $("imca-copy").textContent = "Press Ctrl+C to copy"; }
    setTimeout(() => { $("imca-copy").textContent = "Copy note"; }, 2000);
  });

  let cancelSend = null;
  $("imca-send").addEventListener("click", () => {
    if (cancelSend) cancelSend();
    const btn = $("imca-send"), status = $("imca-send-status");
    btn.disabled = true;
    cancelSend = MedLink.send({
      onTick(left) { status.textContent = `Sending. Reaches Earth in ${MedLink.fmt(left)}.`; },
      onArrive() {
        btn.disabled = false; btn.textContent = "Send again";
        status.textContent = `Delivered to the flight surgeon. Their reply takes at least ${MedLink.fmt(MedLink.mission.delay)} to come back.`;
      },
    });
  });

  MedLink.mountPicker($("imca-mission"));
  const linkNote = () => { $("imca-link-note").textContent = MedLink.mission.note; if (state.step === 4) $("imca-note").value = note(); };
  MedLink.onChange(linkNote); linkNote();

  $("imca-ask-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("imca-ask").value.trim(); if (!q) return;
    const out = $("imca-answer");
    out.hidden = false; out.innerHTML = `<p class="dim pulse">ASTRA is thinking…</p>`;
    try {
      const j = await api("/api/ai/chat", {
        messages: [{ role: "user", content: `I'm the crew medical officer. Here is the consult note:\n${$("imca-note").value.slice(0, 1400)}\n\nMy question: ${q}` }],
        vitals: { ...state.vitals },
      });
      out.innerHTML = `<p>${esc(j.reply).replace(/\n/g, "<br>")}</p>${j.escalate ? `<p class="imca-escalate">Escalate: contact the flight surgeon now.</p>` : ""}`;
    } catch (err) {
      out.innerHTML = `<p class="dim">ASTRA didn't answer: ${esc(err.message === "Failed to fetch" ? "the AstraSight server isn't running" : err.message)}.</p>`;
    }
  });

  $("imca-new").addEventListener("click", () => location.reload());

  /* ---------------- start ---------------- */
  const user = window.AstraAuth && AstraAuth.user;
  if (user && user.name) { state.patient = user.name; $("imca-patient").value = user.name; }
  sample(); renderVitals(); renderFlagBanner(); go(0, false);

  window.AstraIMCA = { state, reportText, note, level };   // for tests and the console
})();
