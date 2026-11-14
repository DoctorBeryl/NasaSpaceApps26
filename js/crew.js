/* ==========================================================
   AstraSight: crew profile, ship PA, and report-screen bus
   Load after vega.js. Used by report.html and the home-page
   VEGA pop-up (js/companion.js).

   Crew.get()            { rank, name }  (signed-in name wins if js/auth.js is loaded)
   Crew.set(patch)       save rank / name in this browser
   Crew.callSign()       "Commander Alex", or "" when no name is set
   Crew.firstName()      "Alex", or ""
   Crew.onChange(fn)     fn() when the profile changes in any tab

   ShipPA.announce({ mood, msg, loc })   chime + spoken crew-wide announcement
   ShipPA.enabled / ShipPA.setEnabled(b)
   ShipPA.log                            newest-first list of announcements
   ShipPA.onLog(fn)

   ReportBus  BroadcastChannel "astrasight-report": the report screen
              sends heartbeats so other tabs know it is open.
   ========================================================== */
const Crew = (() => {
  const KEY = "astrasight.crew";
  const RANKS = ["Commander", "Pilot", "Flight Engineer", "Mission Specialist", "Medical Officer"];
  const listeners = new Set();

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function authName() {
    const u = window.AstraAuth && window.AstraAuth.user;
    return (u && u.name) || "";
  }
  function get() {
    const p = read();
    return { rank: p.rank || "", name: (p.name || authName() || "").trim() };
  }
  function emit() { listeners.forEach((fn) => { try { fn(get()); } catch (e) { console.error(e); } }); }
  function set(patch) {
    const p = { ...read(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
    emit();
  }
  function callSign() {
    const { rank, name } = get();
    return name ? (rank ? `${rank} ${name}` : name) : "";
  }
  function firstName() { return get().name.split(/\s+/)[0] || ""; }

  window.addEventListener("storage", (e) => { if (e.key === KEY) emit(); });
  document.addEventListener("astra:auth", emit);

  return { RANKS, get, set, callSign, firstName, onChange: (fn) => listeners.add(fn) };
})();

const ShipPA = (() => {
  const KEY = "astrasight.pa";
  let enabled = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();
  const log = [];
  const listeners = new Set();
  let actx = null;

  /* Two-tone PA chime; three fast high tones for critical. */
  function chime(mood) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const notes = mood === "critical" ? [988, 988, 988] : [784, 587];
      const step = mood === "critical" ? 0.16 : 0.32;
      notes.forEach((f, i) => {
        const t = actx.currentTime + i * step;
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.95);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + step);
      });
    } catch { /* no audio */ }
  }

  /* Make HUD text sound right when read aloud. */
  function spoken(text) {
    return String(text)
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
      .replace(/\bmSv\/hr?\b/g, "millisieverts per hour")
      .replace(/\bmSv\b/g, "millisieverts")
      .replace(/\bBPM\b/gi, "beats per minute")
      .replace(/(\d)\s?W\b/g, "$1 watts")
      .replace(/\bCO2\b/g, "C O 2")
      .replace(/\bO2\b/g, "O 2")
      .replace(/\b(\d+):(\d{2})\b/g, (_, m, s) => `${+m} minutes ${+s} seconds`)
      .replace(/\b[A-Z]{4,}\b/g, (w) => w.toLowerCase())
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compose({ mood, msg }) {
    const who = Crew.callSign() || "EVA crew member";
    const lead = mood === "critical" ? "Priority alert. Attention all crew." : "Attention all crew.";
    return `${lead} ${who}. ${msg}`;
  }

  function announce(alert) {
    const text = compose(alert);
    const entry = { at: new Date(), mood: alert.mood, loc: alert.loc || "", text, who: Crew.callSign() || "EVA crew member" };
    log.unshift(entry);
    if (log.length > 20) log.pop();
    listeners.forEach((fn) => fn(log));
    if (!enabled) return entry;
    chime(alert.mood);
    setTimeout(() => {
      const t = spoken(text);
      if (window.VEGA && VEGA.speak) VEGA.speak(t);
      else if ("speechSynthesis" in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); }
    }, alert.mood === "critical" ? 600 : 750);
    return entry;
  }

  function setEnabled(b) {
    enabled = !!b;
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* ignore */ }
    if (!enabled && window.VEGA && VEGA.setMuted) { VEGA.setMuted(true); VEGA.setMuted(false); }
    listeners.forEach((fn) => fn(log));
  }

  return {
    announce, setEnabled, compose, spoken, log,
    get enabled() { return enabled; },
    onLog: (fn) => listeners.add(fn),
  };
})();

const ReportBus = (() => {
  const ch = "BroadcastChannel" in window ? new BroadcastChannel("astrasight-report") : null;
  return {
    send(msg) { ch && ch.postMessage(msg); },
    on(fn) { ch && ch.addEventListener("message", (e) => fn(e.data)); },
    supported: !!ch,
  };
})();
