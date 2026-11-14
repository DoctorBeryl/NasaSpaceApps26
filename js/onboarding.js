/* ==========================================================
   AstraSight — first-visit questionnaire (VEGA onboarding)
   Shows on interface.html?welcome=1 (new crew from login.html),
   or ?onboard=1 to run it again. Talks to /api/ai/onboard/*
   (docs/AI-BACKEND.md). Every question can be answered by typing
   or by voice: the mic button uses VEGA.createListener (Web Speech
   API, Chrome/Edge). When done: AstraAuth.saveProfile({ profile, onboarded: true }).
   Load after vega.js and auth.js.
   ========================================================== */
(function () {
  const params = new URLSearchParams(location.search);
  if (!params.has("welcome") && !params.has("onboard")) return;

  // vega.js declares VEGA with const, so it is a global but not a window property
  const V = typeof VEGA !== "undefined" ? VEGA : null;
  const STT = !!(V && V.supported && V.supported.recognition);
  const LOCAL_KEY = "astrasight.onboarding.profile";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MIC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

  let questions = [], queue = [], profile = {}, current = null, total = 0, answered = 0;
  let listener = null, listening = false, selected = new Set(), busy = false;

  /* ---------- DOM ---------- */
  const root = document.createElement("div");
  root.className = "ob-overlay";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "ob-title");
  root.innerHTML = `
    <div class="ob-card">
      <header class="ob-head">
        <div>
          <span class="eyebrow" id="ob-step">Crew setup</span>
          <h2 id="ob-title">Tailor VEGA to you</h2>
        </div>
        <button class="ob-skip" type="button">Skip for now</button>
      </header>
      <div class="ob-progress"><i></i></div>
      <div class="ob-log" aria-live="polite"></div>
      <div class="ob-answer"></div>
      <p class="ob-foot mono">Concept prototype · Simulated data · Not a medical device</p>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const log = $(".ob-log"), area = $(".ob-answer"), bar = $(".ob-progress i");

  // Keep the HUD's keyboard shortcuts (V to talk, arrows for alert steps) from firing while typing here
  root.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") stopMic(); });
  $(".ob-skip").addEventListener("click", () => close(false));

  function bubble(who, html, cls = "") {
    const b = document.createElement("div");
    b.className = `bubble ${who === "VEGA" ? "ai" : "user"} ${cls}`;
    b.innerHTML = `<span class="who">${who}</span>${html}`;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }
  function say(text, html) {
    bubble("VEGA", html || esc(text));
    if (V && !V.muted) V.speak(text);
  }
  function progress() {
    bar.style.width = `${Math.round((answered / Math.max(1, total)) * 100)}%`;
    $("#ob-step").textContent = current ? `${current.topic || "Setup"} · ${Math.min(answered + 1, total)} of ${total}` : "Crew setup";
  }

  /* ---------- API ---------- */
  async function api(path, body) {
    const token = window.AstraAuth ? await AstraAuth.getIdToken().catch(() => null) : null;
    const r = await fetch(`/api/ai/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.message || `HTTP ${r.status}`), { code: data.error });
    return data;
  }

  /* ---------- speech-to-text ---------- */
  function micButton() {
    if (!STT) return "";
    return `<button type="button" class="ob-mic" aria-pressed="false" title="Answer by voice">${MIC}<span>Speak</span></button>`;
  }
  function micNote() {
    return STT ? `<p class="ob-hint" id="ob-hint">Type, or tap <b>Speak</b> and answer out loud.</p>`
               : `<p class="ob-hint">Voice answers need Chrome or Edge. Typing works everywhere.</p>`;
  }
  function setHint(t, warn) { const h = $("#ob-hint"); if (h) { h.textContent = t; h.classList.toggle("warn", !!warn); } }
  function stopMic() { if (listener && listening) listener.stop(); }
  function startMic(onText) {
    if (!STT) return;
    if (listening) return stopMic();
    if (V.stop) V.stop();                   // don't let the mic hear VEGA reading the question
    const btn = $(".ob-mic");
    listener = V.createListener({
      onState(on) {
        listening = on;
        if (btn) { btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on); btn.querySelector("span").textContent = on ? "Listening…" : "Speak"; }
        if (on) setHint("Listening. Answer now, then pause.");
      },
      onInterim(t) { setHint(`“${t}”`); },
      onResult(t) { onText(t); },
      onError(err) {
        const msg = err === "not-allowed" || err === "service-not-allowed" ? "Microphone blocked. Allow it in the address bar, or type instead."
                  : err === "no-speech" ? "I didn't hear anything. Tap Speak to try again."
                  : `Voice input stopped (${err}). You can type instead.`;
        setHint(msg, true);
      },
    });
    try { listener.toggle(); } catch { setHint("Couldn't start the microphone. You can type instead.", true); }
  }

  // Map a spoken phrase to option values: label words, the value itself, and VEGA's tool aliases
  const norm = (s) => String(s).toLowerCase().replace(/₂/g, "2").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  function matchOptions(spoken, options) {
    const t = ` ${norm(spoken)} `;
    const aliases = (V && V.TOOL_ALIASES) || {};
    const hits = [];
    for (const o of options) {
      const label = norm(o.label.split(":")[0]);
      const words = [label, norm(o.value).replace(/-/g, " "), ...(aliases[o.value] || [])];
      if (words.some((w) => w && t.includes(` ${w} `))) { hits.push(o.value); continue; }
      const key = label.split(" ").filter((w) => w.length > 3);
      if (key.length && key.every((w) => t.includes(w))) hits.push(o.value);
    }
    if (/\b(none|no|nothing|first flight)\b/.test(t)) {
      const none = options.find((o) => /none|first/i.test(o.label));
      if (none && !hits.includes(none.value)) hits.push(none.value);
    }
    return hits;
  }

  /* ---------- questions ---------- */
  function ask(q) {
    current = q; selected = new Set(); progress();
    say(q.text);
    const skip = q.optional ? `<button type="button" class="btn btn-ghost ob-skipq">Skip</button>` : "";
    if (q.kind === "text") {
      area.innerHTML = `
        <form class="ob-row">
          <textarea rows="2" maxlength="600" placeholder="${esc(q.placeholder || "Your answer")}" aria-label="Your answer"></textarea>
          ${micButton()}
          <button class="btn btn-primary" type="submit">Send</button>${skip}
        </form>${micNote()}`;
      const ta = area.querySelector("textarea");
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); area.querySelector("form").requestSubmit(); } });
      area.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const v = ta.value.trim(); if (v || q.optional) send(v, v || "Skipped"); else ta.focus(); });
      const mic = area.querySelector(".ob-mic");
      if (mic) mic.addEventListener("click", () => startMic((t) => {
        ta.value = (ta.value ? ta.value.trim() + " " : "") + t;
        setHint("Got it. Edit if needed, then press Send.");
        ta.focus();
      }));
      setTimeout(() => ta.focus({ preventScroll: true }), 60);
    } else {
      const multi = q.kind === "multi";
      area.innerHTML = `
        <div class="ob-options ${multi ? "multi" : ""}" role="group" aria-label="Options">
          ${q.options.map((o) => `<button type="button" class="ob-opt" data-v="${esc(o.value)}" aria-pressed="false">${esc(o.label)}</button>`).join("")}
        </div>
        <div class="ob-row ob-row-end">
          ${micButton()}
          ${multi ? `<button type="button" class="btn btn-primary ob-done">Done</button>` : ""}${skip}
        </div>${micNote().replace("answer out loud", multi ? "say your picks" : "say your choice")}`;
      const opts = [...area.querySelectorAll(".ob-opt")];
      const label = (v) => q.options.find((o) => o.value === v).label;
      const toggle = (v, on) => {
        const isNone = /none|first/i.test(label(v));
        if (on === undefined) on = !selected.has(v);
        if (on) {
          if (isNone) selected.clear(); else for (const s of [...selected]) if (/none|first/i.test(label(s))) selected.delete(s);
          if (q.max && selected.size >= q.max) { setHint(`Pick up to ${q.max}. Tap one to remove it first.`, true); return; }
          selected.add(v);
        } else selected.delete(v);
        opts.forEach((b) => { const s = selected.has(b.dataset.v); b.classList.toggle("on", s); b.setAttribute("aria-pressed", s); });
      };
      const done = () => {
        if (!selected.size && !q.optional) return setHint("Pick at least one, or say them out loud.", true);
        const vals = [...selected];
        send(multi ? vals : vals[0], vals.map(label).join(", ") || "Skipped");
      };
      opts.forEach((b) => b.addEventListener("click", () => {
        if (multi) toggle(b.dataset.v);
        else { selected = new Set([b.dataset.v]); done(); }
      }));
      if (multi) area.querySelector(".ob-done").addEventListener("click", done);
      const mic = area.querySelector(".ob-mic");
      if (mic) mic.addEventListener("click", () => startMic((t) => {
        const hits = matchOptions(t, q.options);
        if (!hits.length) return setHint(`I heard “${t}” but couldn't match it. Try an option's name, or tap it.`, true);
        if (multi) { hits.forEach((v) => toggle(v, true)); setHint(`Selected from “${t}”. Press Done, or speak again to add more.`); }
        else { selected = new Set([hits[0]]); opts.forEach((b) => b.classList.toggle("on", b.dataset.v === hits[0])); setHint(`Heard “${t}”.`); setTimeout(done, 700); }
      }));
    }
    const sk = area.querySelector(".ob-skipq");
    if (sk) sk.addEventListener("click", () => send(q.kind === "multi" ? [] : "", "Skipped"));
  }

  async function send(answer, shown) {
    if (busy) return;
    busy = true; stopMic();
    bubble("You", esc(shown));
    area.querySelectorAll("button, textarea").forEach((el) => (el.disabled = true));
    const thinking = bubble("VEGA", `<span class="ob-dots"><i></i><i></i><i></i></span>`, "ob-thinking");
    try {
      const r = await api("onboard/answer", { questionId: current.id, answer, profile });
      profile = r.profile || profile;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(profile)); } catch {}
      thinking.remove();
      if (r.ack) bubble("VEGA", esc(r.ack));
      if (!current.id.endsWith(".followup")) answered++;
      if (r.followUp) queue.unshift(r.followUp);
    } catch (e) {
      thinking.remove();
      bubble("VEGA", `I couldn't save that (${esc(e.message)}). Try again.`, "ob-error");
      busy = false;
      return ask(current);
    }
    busy = false;
    next();
  }

  function next() {
    if (queue.length) return ask(queue.shift());
    finish();
  }

  async function finish() {
    current = null; answered = total; progress();
    $("#ob-step").textContent = "All set";
    $(".ob-skip").hidden = true;
    area.innerHTML = "";
    const thinking = bubble("VEGA", `<span class="ob-dots"><i></i><i></i><i></i></span>`, "ob-thinking");
    try {
      const r = await api("onboard/finish", { profile });
      profile = r.profile || profile;
    } catch (e) {
      console.warn("[onboarding] finish failed:", e.message);
    }
    thinking.remove();
    const t = profile.tailoring || {};
    say(t.welcome || "You're all set. I'll keep an eye on your readings.");
    if (t.summary) bubble("VEGA", `<span class="dim">${esc(t.summary)}</span>`);
    bubble("VEGA", `<b>Quick tour</b>
      <ul class="ob-tour">
        <li>Your vitals sit in the <b>side panel</b>. Say “move panel left” or “hide panel”.</li>
        <li>To talk, press both side buttons or say <b>“Hey VEGA”</b>. On this page, press <b>V</b> or type in the command box.</li>
        <li>Alerts are color coded. Green is normal, amber needs attention, red goes to the flight surgeon.</li>
        <li>Any personal thresholds I suggested stay <b>proposed</b> until a flight surgeon signs off.</li>
      </ul>`);
    area.innerHTML = `<div class="ob-row ob-row-end"><button type="button" class="btn btn-primary ob-go">Go to my HUD →</button></div>`;
    area.querySelector(".ob-go").addEventListener("click", () => close(true));
    log.scrollTop = log.scrollHeight;
  }

  async function close(done) {
    stopMic();
    if (V && V.stop) V.stop();
    if (done && window.AstraAuth && AstraAuth.user) {
      try { await AstraAuth.saveProfile({ profile, onboarded: true }); } catch (e) { console.warn("[onboarding] save failed:", e.message); }
    }
    try { if (done) localStorage.removeItem(LOCAL_KEY); } catch {}
    root.classList.add("closing");
    setTimeout(() => root.remove(), 250);
    document.body.classList.remove("ob-open");
    params.delete("welcome"); params.delete("onboard");
    history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : "") + location.hash);
  }

  /* ---------- start ---------- */
  async function start() {
    document.body.appendChild(root);
    document.body.classList.add("ob-open");
    const user = window.AstraAuth ? await AstraAuth.ready.catch(() => null) : null;
    if (params.has("welcome") && user && !(await AstraAuth.needsOnboarding())) return close(false);
    const name = user && user.name ? user.name.split(" ")[0] : "";
    try { profile = JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { profile = {}; }
    if (name && !profile.callsign) profile.name = name;

    let data;
    try { data = await api("onboard/questions"); }
    catch {
      bubble("VEGA", "I can't reach the AstraSight server, so I can't run the setup questions. Start it with <code>node server.js</code> and reload, or skip for now.", "ob-error");
      area.innerHTML = `<div class="ob-row ob-row-end"><button type="button" class="btn btn-ghost">Skip for now</button></div>`;
      area.querySelector("button").addEventListener("click", () => close(false));
      return;
    }
    questions = data.questions || [];
    total = questions.length;
    queue = questions.slice();
    say(`Welcome aboard${name ? ", " + name : ""}. I have ${total} quick questions so I can tailor your baselines and how I talk to you.`,
        `Welcome aboard${name ? ", <b>" + esc(name) + "</b>" : ""}. I have ${total} quick questions so I can tailor your baselines and how I talk to you.` +
        (STT ? ` You can type each answer or tap <b>Speak</b> and say it.` : ""));
    area.innerHTML = `<div class="ob-row ob-row-end"><button type="button" class="btn btn-primary ob-begin">Start</button></div>`;
    area.querySelector(".ob-begin").addEventListener("click", () => { area.innerHTML = ""; next(); });
    area.querySelector(".ob-begin").focus({ preventScroll: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
