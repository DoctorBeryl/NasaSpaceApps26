/* ==========================================================
   VEGA — Vital Evaluation & Guidance Assistant
   Lightweight on-device intent model (rule-based prototype).
   parse(text) -> { intent, slots, confidence, normalized }
   ========================================================== */
const VEGA = (() => {
  const TOOL_ALIASES = {
    cardio: ["heart rate", "heart", "pulse", "bpm", "cardiac", "cardio", "rhythm"],
    spo2: ["oxygen", "o2", "spo2", "saturation", "blood oxygen"],
    resp: ["breathing", "respiration", "respiratory", "breath", "breaths"],
    neuro: ["neuro", "pupil", "pupils", "eye", "eyes", "ocular", "vision", "sans"],
    cog: ["fatigue", "fatigued", "tired", "cognitive", "focus", "workload", "load", "sleepy"],
    thermal: ["temperature", "temp", "fever", "thermal", "hot", "cold"],
    rad: ["radiation", "dose", "dosimeter", "rad", "sievert", "solar"],
    hrv: ["stress", "stressed", "hrv", "variability", "anxious", "recovery"],
  };

  // Ordered: first match wins. Each rule: [intent, regex, baseConfidence]
  const RULES = [
    ["breathing", /\b(breathing exercise|calm me|relax|guided breath|help me breathe)\b/, 0.9],
    ["help", /\b(help|what can you do|commands|options)\b/, 0.95],
    ["unmute", /\b(unmute|speak again|voice on|talk to me)\b/, 0.93],
    ["mute", /\b(mute|be quiet|silence|stop talking)\b/, 0.93],
    ["panel_hide", /\b(hide|close|collapse|minimi[sz]e|dismiss)\b.*\bpanel\b|\bclear (my )?view\b/, 0.94],
    ["panel_show", /\b(show|open|bring back|expand)\b.*\bpanel\b/, 0.94],
    ["dock_left", /\b(move|dock|put|switch)\b.*\bleft\b/, 0.92],
    ["dock_right", /\b(move|dock|put|switch)\b.*\bright\b/, 0.92],
    ["clear_alert", /\b(dismiss|acknowledge|clear( the)? alert|cancel alert|i'?m (ok|fine))\b/, 0.92],
    ["simulate_alert", /\b(simulate|test|trigger)\b.*\b(alert|emergency|alarm)\b|\bemergency\b/, 0.9],
    ["show_log", /\b(show|open)\b.*\b(log|history|transcript)\b/, 0.9],
    ["show_vitals", /\b(show|open|back to)\b.*\b(vitals|dashboard)\b/, 0.9],
    ["next_step", /^(vega,? )?(next|forward|continue|go on)( step| one| please)?$|\bnext (step|instruction)\b/, 0.9],
    ["prev_step", /^(vega,? )?(back|previous|prev|go back)( step| one| please)?$|\b(previous|last) (step|instruction)\b|\bstep back\b/, 0.9],
    ["full_scan", /\b(full|complete|whole|entire|all)\b.*\b(scan|diagnostic|diagnostics|check|systems)\b|\brun diagnostics\b|\bscan me\b/, 0.93],
    ["scan_tool", /\b(run|start|begin|do)\b.*\b(scan|test|check|reading)\b/, 0.86],
    ["status_report", /\b(status|report|summary|overview|how am i|am i ok|vitals report)\b/, 0.9],
    ["show_tool", /\b(show|open|display|check|what'?s|what is|how'?s|how is|how|tell me|focus|view|read)\b/, 0.82],
  ];

  function findTool(text) {
    let best = null, bestLen = 0;
    for (const [id, words] of Object.entries(TOOL_ALIASES)) {
      for (const w of words) {
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (re.test(text) && w.length > bestLen) { best = id; bestLen = w.length; }
      }
    }
    return best;
  }

  function normalize(raw) {
    return raw.toLowerCase()
      .replace(/[’]/g, "'")
      .replace(/^\s*(hey|ok|okay|hi)?\s*,?\s*vega\s*[,.!]?\s*/i, "")
      .replace(/[^\w\s'%₂]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parse(raw) {
    const text = normalize(raw || "");
    const woke = /\bvega\b/i.test(raw || "");
    const tool = findTool(text);
    let intent = "unknown", confidence = 0.2;

    for (const [name, re, conf] of RULES) {
      if (re.test(text)) { intent = name; confidence = conf; break; }
    }
    // A bare tool mention ("oxygen?") is a show request
    if (intent === "unknown" && tool) { intent = "show_tool"; confidence = 0.74; }
    // Tool-dependent intents need a tool
    if ((intent === "show_tool" || intent === "scan_tool") && !tool) {
      if (intent === "scan_tool") { intent = "full_scan"; confidence = 0.7; }
      else { intent = "unknown"; confidence = 0.3; }
    }
    if (woke) confidence = Math.min(0.99, confidence + 0.04);

    return {
      intent,
      slots: tool ? { tool } : {},
      confidence: +confidence.toFixed(2),
      normalized: text,
      wake_word: woke,
    };
  }

  /* ---------------- speech I/O ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let muted = false;
  let voice = null;

  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /Google UK English Female|Samantha|Aria|Jenny|Libby|Sonia/i.test(v.name))
      || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function speakBrowser(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.02; u.pitch = 1.05;
    speechSynthesis.speak(u);
  }

  /* ElevenLabs voice via the local server's /api/tts proxy (key lives in .env on the server).
     Tries this page's own origin first, then node server.js on localhost:8000, so the voice
     still works when the page comes from another static server (npx serve, Live Server, ...).
     Falls back to the browser voice when no proxy answers or TTS fails. */
  const TTS_FALLBACK = "http://localhost:8000/api/tts";
  const probe = (u) => fetch(u).then((r) => (r.ok ? u : null)).catch(() => null);
  const ttsUrl = (location.protocol.startsWith("http") ? probe("/api/tts") : Promise.resolve(null))
    .then((u) => u || (location.origin === "http://localhost:8000" ? null : probe(TTS_FALLBACK)))
    .then((u) => {
      if (!u) console.warn("VEGA: no ElevenLabs proxy found, using the browser voice. Run `node server.js` and open http://localhost:8000");
      return u;
    });
  let audio = null, seq = 0;

  function stopAll() {
    seq++;
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); audio = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  async function speak(text) {
    if (muted || !text) return;
    stopAll();
    const id = seq;
    const url = await ttsUrl;
    if (url) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!r.ok) throw new Error(r.status);
        const blob = await r.blob();
        if (id !== seq || muted) return;          // something newer was said meanwhile
        audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        return;
      } catch (e) {
        if (id !== seq || muted) return;
        console.warn("ElevenLabs TTS unavailable, using browser voice:", e.message || e);
      }
    }
    if (id === seq) speakBrowser(text);
  }

  /* Free-form chat via the local server's /api/chat proxy to Ollama. The server owns the
     system prompt; the page only sends user/assistant turns plus a live-readings summary.
     Same origin first, then node server.js on localhost:8000, like the TTS proxy. */
  const CHAT_FALLBACK = "http://localhost:8000/api/chat";
  let chatUrlP = null;
  function chatUrl() {
    if (!chatUrlP) {
      chatUrlP = (location.protocol.startsWith("http") ? probe("/api/chat") : Promise.resolve(null))
        .then((u) => u || (location.origin === "http://localhost:8000" ? null : probe(CHAT_FALLBACK)))
        .then((u) => {
          if (!u) { console.warn("VEGA: Ollama chat not available. Start Ollama, pull the model, and run `node server.js`."); chatUrlP = null; }
          return u;
        });
    }
    return chatUrlP;
  }

  async function ask(messages, context = "") {
    const url = await chatUrl();
    if (!url) return null;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, context }) });
    if (!r.ok) throw new Error(`chat ${r.status}`);
    return (await r.json()).reply;
  }

  function setMuted(m) { muted = m; if (m) stopAll(); }

  function createListener({ onResult, onInterim, onState, onError }) {
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let active = false;
    rec.onstart = () => { active = true; onState && onState(true); };
    rec.onend = () => { active = false; onState && onState(false); };
    rec.onerror = (e) => onError && onError(e.error);
    rec.onresult = (e) => {
      let finalText = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      if (interim && onInterim) onInterim(interim);
      if (finalText) onResult(finalText.trim());
    };
    return {
      toggle() { active ? rec.stop() : rec.start(); },
      stop() { if (active) rec.stop(); },
    };
  }

  return {
    parse, speak, ask, chatAvailable: () => chatUrl().then(Boolean), setMuted, createListener,
    get muted() { return muted; },
    supported: { recognition: !!SR, synthesis: "speechSynthesis" in window },
    TOOL_ALIASES,
  };
})();
