/* ==========================================================
   AstraSight: MedLink, the simulated link to the flight surgeon.
   Shared by imca.html and ultrasound.html. Messages to Earth take
   the one-way light time for the chosen mission, so the page shows
   a countdown instead of pretending the reply is instant.
   ========================================================== */
(function () {
  // One-way signal delay in seconds. Mars varies from about 3 to 22 minutes;
  // 12.5 minutes is a mid-range value for the demo.
  const MISSIONS = [
    { id: "iss", label: "ISS (low Earth orbit)", delay: 0.5, note: "Live link. The flight surgeon can guide you in real time." },
    { id: "moon", label: "Artemis (lunar orbit)", delay: 1.3, note: "1.3 s each way. Live guidance still works, with a small lag." },
    { id: "mars", label: "Mars transit", delay: 750, note: "About 12.5 min each way today (3 to 22 min over the orbit). Nobody on Earth can guide you live." },
  ];
  const KEY = "astrasight.mission";
  const listeners = new Set();
  let current = MISSIONS[2];
  try { current = MISSIONS.find((m) => m.id === localStorage.getItem(KEY)) || current; } catch {}

  function fmt(sec) {
    if (sec < 10) return `${sec.toFixed(1)} s`;
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
  }

  /* <select> for the mission, kept in sync across both pages through localStorage. */
  function mountPicker(el) {
    el.innerHTML = MISSIONS.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");
    el.value = current.id;
    el.addEventListener("change", () => set(el.value));
    listeners.add(() => { el.value = current.id; });
  }

  function set(id) {
    current = MISSIONS.find((m) => m.id === id) || current;
    try { localStorage.setItem(KEY, current.id); } catch {}
    listeners.forEach((fn) => fn(current));
  }

  /*
   * Send something to the flight surgeon. Calls onTick(secondsLeft) every 250 ms
   * and onArrive() when the signal reaches Earth. Returns a cancel function.
   */
  function send({ onTick, onArrive }) {
    const total = current.delay, start = performance.now();
    const t = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - start) / 1000);
      onTick && onTick(left, total);
      if (left <= 0) { clearInterval(t); onArrive && onArrive(); }
    }, 250);
    onTick && onTick(total, total);
    return () => clearInterval(t);
  }

  window.MedLink = { MISSIONS, get mission() { return current; }, set, onChange: (fn) => listeners.add(fn), mountPicker, send, fmt };
})();
