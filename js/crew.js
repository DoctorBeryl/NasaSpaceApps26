/* ==========================================================
   AstraSight: crew profile, ship PA, and report-screen bus
   Load after vega.js. Used by report.html and the home-page
   ASTRA pop-up (js/companion.js).

   Crew.get()            { rank, role, name, guest }. Name = questionnaire call sign, else the
                         signed-in name (js/auth.js); "" for guests. Never asked for.
                         role = the crew role picked at sign-in (login.html); rank is its title
                         for announcements ("Medical Officer"), "" for guests and "other".
   Crew.set(patch)       kept for old callers; rank and name both come from sign-in now
   Crew.isGuest()        true when nobody is signed in
   Crew.callSign()       "Commander Alex", or "" when no name is set
   Crew.firstName()      "Alex", or ""
   Crew.onChange(fn)     fn() when the profile changes in any tab

   ShipPA.announce({ mood, msg, loc })   chime + spoken crew-wide announcement
   ShipPA.enabled / ShipPA.setEnabled(b)  turning it on re-reads the current alert from the start
   ShipPA.ack()                          stop the voice now and forget the current alert
   ShipPA.stopVoice() / ShipPA.clear()   stop speaking / forget the alert without stopping
   ShipPA.log                            newest-first list of announcements
   ShipPA.onLog(fn)

   ReportBus  BroadcastChannel "astrasight-report": the report screen
              sends heartbeats so other tabs know it is open.
   ========================================================== */
const Crew = (() => {
  const KEY = "astrasight.crew";
  const RANKS = ["Commander", "Pilot", "Flight Engineer", "Mission Specialist", "Payload Specialist", "Medical Officer"];
  const RANK_OF = { commander: "Commander", pilot: "Pilot", "flight-engineer": "Flight Engineer", "mission-specialist": "Mission Specialist", "payload-specialist": "Payload Specialist", "medical-officer": "Medical Officer" };
  const listeners = new Set();

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  /* The name comes only from the sign-in: the onboarding questionnaire's call sign if they gave one,
     else the name they enrolled with. Nobody signed in = guest (no name; alerts say "EVA crew member").
     ASTRA never asks for a name, and names typed into this browser earlier are ignored. */
  let profileName = "", profileRole = "";
  function authUser() { return (window.AstraAuth && window.AstraAuth.user) || null; }
  function authName() { const u = authUser(); return (u && u.name) || ""; }
  function loadProfileName() {
    const u = authUser();
    if (!u || !window.AstraAuth.getProfile) { if (profileName || profileRole) { profileName = profileRole = ""; emit(); } return; }
    window.AstraAuth.getProfile().then((doc) => {
      const cs = ((doc && doc.profile && doc.profile.callsign) || "").trim();
      const role = (doc && ((doc.profile && doc.profile.role) || doc.role)) || u.role || "";
      if (cs !== profileName || role !== profileRole) { profileName = cs; profileRole = role; emit(); }
    }).catch(() => {});
  }
  function get() {
    const u = authUser();
    const role = u ? (profileRole || u.role || "") : "";
    return { rank: RANK_OF[role] || "", role, name: u ? (profileName || authName()).trim() : "", guest: !u };
  }
  function emit() { listeners.forEach((fn) => { try { fn(get()); } catch (e) { console.error(e); } }); }
  function set(patch) {
    const p = { ...read(), ...patch };   // nothing reads this any more; rank comes from the sign-in role
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
    emit();
  }
  function callSign() {
    const { rank, name } = get();
    return name ? (rank ? `${rank} ${name}` : name) : "";
  }
  function firstName() { return get().name.split(/\s+/)[0] || ""; }

  window.addEventListener("storage", (e) => { if (e.key === KEY) emit(); });
  document.addEventListener("astra:auth", () => { emit(); loadProfileName(); });
  if (authUser()) loadProfileName();

  function isGuest() { return !authUser(); }

  return { RANKS, RANK_OF, get, set, callSign, firstName, isGuest, onChange: (fn) => listeners.add(fn) };
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

  let current = null, pending = 0;   // the alert being announced, and its queued speech
  function stopVoice() {
    clearTimeout(pending); pending = 0;
    if (typeof VEGA !== "undefined" && VEGA.stop) VEGA.stop();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  function say(alert) {
    stopVoice();
    chime(alert.mood);
    pending = setTimeout(() => {
      pending = 0;
      const t = spoken(compose(alert));
      if (typeof VEGA !== "undefined" && VEGA.speak) VEGA.speak(t, { tone: VEGA.toneFor(alert.mood) });
      else if ("speechSynthesis" in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); }
    }, alert.mood === "critical" ? 600 : 750);
  }
  /* Acknowledge: stop speaking now and forget the alert, so turning the PA on doesn't replay it. */
  function ack() { current = null; stopVoice(); }
  function clear() { current = null; }

  function announce(alert) {
    current = alert;
    const text = compose(alert);
    const entry = { at: new Date(), mood: alert.mood, loc: alert.loc || "", text, who: Crew.callSign() || "EVA crew member" };
    log.unshift(entry);
    if (log.length > 20) log.pop();
    listeners.forEach((fn) => fn(log));
    if (!enabled) return entry;
    say(alert);
    return entry;
  }

  function setEnabled(b) {
    enabled = !!b;
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* ignore */ }
    if (!enabled) stopVoice();
    else if (current) say(current);   // PA back on: read the current alert again from the start
    listeners.forEach((fn) => fn(log));
  }

  return {
    announce, setEnabled, compose, spoken, log, ack, clear, stopVoice,
    get current() { return current; },
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
