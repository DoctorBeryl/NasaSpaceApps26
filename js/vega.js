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

  // How the crew member says they feel. Checked before RULES so "help, I feel dizzy" is a
  // symptom, not a help request. "red" mirrors RED_FLAGS in server/ai.js: escalate at once.
  // "selfharm" gets its own gentle reply. Tiredness, stress, hot or cold stay tool aliases above.
  const SYMPTOMS = [
    ["selfharm", /\b(suicid\w*|kill myself|hurt myself|end my life)\b/],
    ["red", /\b(chest pain|chest (is )?tight\w*|pass(ed)? out|faint(ed|ing)?|black(ed)? out|can'?t breathe|cannot breathe|short of breath|vision loss|lost (my )?vision|can'?t see|confus(ed|ion)|worst headache|seizure|unconscious|numb(ness)? (in|on) (my )?(face|arm|leg)|slurred)\b/],
    ["dizzy", /\b(light ?headed\w*|dizz(y|iness)|woozy|vertigo|spinning|unsteady|off balance|wobbly)\b/],
    ["headache", /\b(head ?aches?|my head (hurts|is pounding|is killing me)|migraine|head pressure)\b/],
    ["nausea", /\b(nause\w*|queasy|vomit\w*|throw(ing)? up|threw up|sick to my stomach|feel(ing)? sick|motion sick\w*|space sick\w*)\b/],
  ];

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
    let intent = "unknown", confidence = 0.2, symptom = null;

    const hit = SYMPTOMS.find(([, re]) => re.test(text));
    if (hit) { intent = "symptom"; confidence = 0.9; symptom = hit[0]; }
    else for (const [name, re, conf] of RULES) {
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
      slots: { ...(tool ? { tool } : {}), ...(symptom ? { symptom } : {}) },
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

  /* Delivery by situation. "urgent" is quicker and a touch lower and steadier, so it sounds
     firm rather than alarmed; a higher, wobblier voice reads as panic. The server keeps its
     own ElevenLabs settings for each tone. */
  const TONES = {
    calm:    { rate: 1.02, pitch: 1.05 },
    caution: { rate: 1.05, pitch: 1.0 },
    urgent:  { rate: 1.12, pitch: 0.92 },
  };
  /* Map an alert zone or report mood to a tone: crit/critical -> urgent, warn/caution -> caution. */
  function toneFor(level) {
    if (level === "crit" || level === "critical" || level === "urgent") return "urgent";
    if (level === "warn" || level === "caution" || level === "reminder") return "caution";
    return "calm";
  }

  function speakBrowser(text, tone) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    const t = TONES[tone] || TONES.calm;
    u.rate = t.rate; u.pitch = t.pitch;
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

  async function speak(text, { tone = "calm" } = {}) {
    if (muted || !text) return;
    tone = toneFor(tone);
    stopAll();
    const id = seq;
    const url = await ttsUrl;
    if (url) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, tone }) });
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
    if (id === seq) speakBrowser(text, tone);
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

  /* Server-side speech-to-text fallback (/api/stt, ElevenLabs Scribe). Chrome's Web Speech API
     streams audio to Google; when that fails with "network" (offline, VPN/firewall, Brave,
     Chromium builds) we record the clip ourselves and let server.js transcribe it. */
  const STT_FALLBACK = "http://localhost:8000/api/stt";
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  let sttUrlP = null;
  let preferRecorder = !SR;              // flips to true for the session after a "network" error
  function sttUrl() {
    if (!sttUrlP) {
      sttUrlP = (location.protocol.startsWith("http") ? probe("/api/stt") : Promise.resolve(null))
        .then((u) => u || (location.origin === "http://localhost:8000" ? null : probe(STT_FALLBACK)))
        .then((u) => { if (!u) sttUrlP = null; return u; });
    }
    return sttUrlP;
  }

  /* Record one utterance: stops after ~1.2 s of silence once speech is heard, after 4 s with no
     speech ("no-speech"), or at 12 s. Then posts the clip to /api/stt. */
  function createRecorder({ onResult, onInterim, onState, onError }) {
    let active = false, stopFn = null;
    async function start() {
      const url = await sttUrl();
      if (!url) return onError && onError("network");
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { return onError && onError(e.name === "NotAllowedError" ? "not-allowed" : "audio-capture"); }
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      let heard = false, cancelled = false, raf = 0;
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const an = ac.createAnalyser(); an.fftSize = 1024;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const t0 = performance.now(); let lastLoud = t0;
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let s = 0; for (const v of buf) s += v * v;
        const now = performance.now();
        if (Math.sqrt(s / buf.length) > 0.02) { heard = true; lastLoud = now; }
        if ((heard && now - lastLoud > 1200) || (!heard && now - t0 > 4000) || now - t0 > 12000) return finish(false);
        raf = requestAnimationFrame(tick);
      };
      function finish(cancel) {
        cancelled = cancel;
        cancelAnimationFrame(raf);
        if (mr.state !== "inactive") mr.stop();
      }
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        ac.close().catch(() => {});
        active = false; stopFn = null; onState && onState(false);
        if (cancelled) return;
        if (!heard) return onError && onError("no-speech");
        onInterim && onInterim("Transcribing…");
        try {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          const r = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          if (!r.ok) throw new Error(r.status);
          const text = String((await r.json()).text || "").trim();
          text ? onResult(text) : onError && onError("no-speech");
        } catch (e) {
          console.warn("VEGA: server transcription failed:", e.message || e);
          onError && onError("network");
        }
      };
      mr.start(250);
      active = true; stopFn = () => finish(false);
      onState && onState(true);
      raf = requestAnimationFrame(tick);
    }
    return {
      toggle() { active ? stopFn && stopFn() : start(); },
      stop() { if (active && stopFn) stopFn(); },
    };
  }

  function createListener(handlers) {
    if (!SR && !canRecord) return null;
    const recorder = canRecord ? createRecorder(handlers) : null;
    if (!SR || (preferRecorder && recorder)) return recorder;
    const { onResult, onInterim, onState, onError } = handlers;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let active = false, switched = false;
    rec.onstart = () => { active = true; onState && onState(true); };
    rec.onend = () => { active = false; onState && onState(false); };
    rec.onerror = (e) => {
      // Browser speech service unreachable: switch to recording + server transcription and retry now.
      if (e.error === "network" && recorder) {
        return sttUrl().then((u) => {
          if (!u) return onError && onError("network");
          console.warn("VEGA: browser speech service unreachable, using server transcription (/api/stt)");
          preferRecorder = switched = true;
          recorder.toggle();
        });
      }
      onError && onError(e.error);
    };
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
      toggle() { if (switched) return recorder.toggle(); active ? rec.stop() : rec.start(); },
      stop() { if (switched) return recorder.stop(); if (active) rec.stop(); },
    };
  }

  return {
    parse, speak, stop: stopAll, toneFor, ask, chatAvailable: () => chatUrl().then(Boolean), setMuted, createListener,
    get muted() { return muted; },
    supported: { recognition: !!SR || canRecord, synthesis: "speechSynthesis" in window },
    TOOL_ALIASES,
  };
})();
