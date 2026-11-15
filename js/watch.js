/* ==========================================================
   AstraSight — live readings from a real watch (window.AstraWatch)
   Two ways in, both optional. Without either, pages keep their simulation.
   1. Garmin AstraLink app (garmin/AstraLink): the watch posts to /api/watch through the
      phone; this page polls /api/watch/<pair code>. HR, HRV, SpO2, respiration, stress.
   2. Bluetooth heart-rate broadcast (any watch or strap, no watch code): Web Bluetooth,
      Chrome or Edge on a secure origin. HR, plus HRV when the strap sends beat intervals.
   UI: AstraWatch.openDialog() ("Connect a sensor or device"), used by tools.html.
   AstraWatch.get(toolId) returns a live value for a TOOLS id, or null when there is no
   fresh reading, so callers fall back to simulated data on their own. Docs: docs/GARMIN.md
   ========================================================== */
const AstraWatch = (() => {
  const CODE_KEY = "astrasight.watch.code";
  const STALE_MS = 15000;      // older than this counts as disconnected
  const POLL_MS = 2000;
  const API = /^https?:$/.test(location.protocol) ? "" : "http://localhost:8000";

  /* Watch field -> TOOLS id. Garmin's stress score (0-100) stands in for the
     cognitive-load index; both are "higher = more strained" on the same scale. */
  const MAP = { hr: "cardio", hrv: "hrv", spo2: "spo2", resp: "resp", stress: "cog" };
  const LABEL = { cardio: "optical heart-rate sensor", hrv: "beat-to-beat intervals (RMSSD)", spo2: "pulse oximeter", resp: "respiration sensor", cog: "device stress score" };

  let code = null;
  try { code = localStorage.getItem(CODE_KEY); } catch {}
  let pollTimer = null, polling = false;
  let garmin = { at: 0, data: {} };      // last server reading
  let ble = { at: 0, data: {}, device: null, name: "" };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(status()); } catch (e) { console.error(e); } });

  /* ---------- Garmin AstraLink via the server ---------- */
  async function pollOnce() {
    if (!code || polling) return;
    polling = true;
    try {
      const r = await fetch(`${API}/api/watch/${code}`, { cache: "no-store" });
      const j = await r.json();
      const was = isFresh(garmin.at);
      if (j.connected) garmin = { at: Date.now() - (j.ageMs || 0), data: j.data || {} };
      if (was !== isFresh(garmin.at) || j.connected) emit();
    } catch { /* server offline: stay on whatever we have, it goes stale on its own */ }
    polling = false;
  }

  function pair(newCode) {
    const c = String(newCode || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{6}$/.test(c)) return false;
    code = c; garmin = { at: 0, data: {} };
    try { localStorage.setItem(CODE_KEY, c); } catch {}
    startPolling(); pollOnce(); emit();
    return true;
  }

  function unpair() {
    code = null; garmin = { at: 0, data: {} };
    try { localStorage.removeItem(CODE_KEY); } catch {}
    clearInterval(pollTimer); pollTimer = null; emit();
  }

  function startPolling() {
    clearInterval(pollTimer);
    if (code) pollTimer = setInterval(pollOnce, POLL_MS);
  }

  /* ---------- Bluetooth heart-rate broadcast (GATT 0x180D) ---------- */
  const rr = []; // recent beat intervals in ms
  function rmssd() {
    if (rr.length < 8) return null;
    let sum = 0, n = 0;
    for (let i = 1; i < rr.length; i++) {
      const d = rr[i] - rr[i - 1];
      if (Math.abs(d) > rr[i - 1] * 0.2) continue; // skip artifacts and ectopic-looking jumps
      sum += d * d; n++;
    }
    return n >= 5 ? Math.sqrt(sum / n) : null;
  }

  function onHeartRate(e) {
    const dv = e.target.value, flags = dv.getUint8(0);
    let i = 1;
    const hr = flags & 1 ? dv.getUint16(i, true) : dv.getUint8(i);
    i += flags & 1 ? 2 : 1;
    if (flags & 0x08) i += 2;                 // energy expended
    if (flags & 0x10) {                       // RR intervals, 1/1024 s
      for (; i + 1 < dv.byteLength; i += 2) {
        const ms = dv.getUint16(i, true) * 1000 / 1024;
        if (ms > 300 && ms < 2000) { rr.push(ms); if (rr.length > 40) rr.shift(); }
      }
    }
    const data = {};
    if (hr > 0) data.hr = hr;
    const h = rmssd(); if (h != null) data.hrv = h;
    ble = { ...ble, at: Date.now(), data };
    emit();
  }

  async function connectBluetooth() {
    if (!navigator.bluetooth) throw new Error("This browser has no Web Bluetooth. Use Chrome or Edge on localhost or https.");
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
    device.addEventListener("gattserverdisconnected", () => { ble = { at: 0, data: {}, device: null, name: "" }; emit(); });
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService("heart_rate");
    const ch = await svc.getCharacteristic("heart_rate_measurement");
    ch.addEventListener("characteristicvaluechanged", onHeartRate);
    await ch.startNotifications();
    ble = { at: 0, data: {}, device, name: device.name || "Bluetooth HR" };
    rr.length = 0; emit();
    return ble.name;
  }

  function disconnectBluetooth() {
    try { ble.device?.gatt?.disconnect(); } catch {}
    ble = { at: 0, data: {}, device: null, name: "" }; emit();
  }

  /* ---------- reading it ---------- */
  const isFresh = (at) => at > 0 && Date.now() - at < STALE_MS;

  /* Live value for a TOOLS id, or null. Bluetooth wins for HR (lower latency). */
  function get(toolId) {
    const field = Object.keys(MAP).find((k) => MAP[k] === toolId);
    if (!field) return null;
    if (isFresh(ble.at) && ble.data[field] != null) return ble.data[field];
    if (isFresh(garmin.at) && garmin.data[field] != null) return garmin.data[field];
    return null;
  }

  function status() {
    const g = isFresh(garmin.at), b = isFresh(ble.at);
    const live = Object.values(MAP).filter((id) => get(id) != null);
    return {
      live: g || b, code, garmin: g, bluetooth: b, bluetoothName: ble.name,
      device: b ? ble.name : g ? (garmin.data.device || "Garmin watch") : "",
      ageMs: g ? Date.now() - garmin.at : null, liveIds: live,
      waiting: !!code && !g, extra: g ? { ...garmin.data } : {},
    };
  }

  /* Readings with no HUD tool of their own, ready to show or hand to ASTRA.
     [field, label, unit, decimals, note]. Only fields the watch actually sent are returned. */
  const EXTRA = [
    ["bodyBattery", "Body Battery", "/100", 0, "Garmin's energy reserve estimate"],
    ["motion", "Movement", "mg", 0, "accelerometer, last few seconds"],
    ["activeMin", "Intensity min", "this wk", 0, "exercise countermeasure tracking"],
    ["recoveryHours", "Recovery time", "h", 0, "until fully recovered from the last workout"],
    ["restingHr", "Resting HR", "bpm", 0, "personal baseline"],
    ["maxHr", "Max HR", "bpm", 0, ""],
    ["vo2max", "VO₂ max", "", 0, "aerobic fitness"],
    ["sdnn", "HRV (SDNN)", "ms", 0, ""],
    ["steps", "Steps today", "", 0, ""],
    ["calories", "Calories today", "kcal", 0, ""],
    ["floors", "Floors climbed", "", 0, ""],
    ["pressure", "Pressure", "kPa", 1, "watch barometer"],
    ["temp", "Wrist temp", "°C", 1, "wrist and air, not core temperature"],
    ["battery", "Watch battery", "%", 0, ""],
  ];
  const MOTION = (mg) => mg < 40 ? "still" : mg < 150 ? "light" : mg < 400 ? "moderate" : "vigorous";

  function extras() {
    if (!isFresh(garmin.at)) return [];
    const d = garmin.data, out = [];
    for (const [key, label, unit, dec, note] of EXTRA) {
      if (d[key] == null) continue;
      let text = `${Number(d[key]).toFixed(dec)}${unit ? " " + unit : ""}`;
      if (key === "motion") text = MOTION(d.motion);
      out.push({ key, label, value: d[key], unit, note, text });
    }
    if (d.hr != null && d.maxHr) out.splice(1, 0, { key: "hrPct", label: "Effort", value: Math.round(d.hr / d.maxHr * 100), unit: "% of max HR", note: "", text: `${Math.round(d.hr / d.maxHr * 100)} % max HR` });
    return out;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // Notice when a source goes stale even if nothing else happens.
  let lastLive = false;
  setInterval(() => { const s = status().live; if (s !== lastLive) { lastLive = s; emit(); } }, 3000);
  if (code) { startPolling(); pollOnce(); }

  /* ---------- "Connect a sensor or device" dialog ---------- */
  let dlg = null;
  function openDialog() {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "watch-dlg";
      dlg.setAttribute("aria-labelledby", "wd-title");
      dlg.innerHTML = `
        <h3 id="wd-title">Connect a sensor or device</h3>
        <p class="wd-status" role="status"></p>
        <section>
          <strong>Device with a pair code</strong>
          <p>Start the AstraLink app on the device (a phone nearby carries its data), then type the 6-character code it shows. Sends heart rate, HRV, SpO₂, breathing, stress and more.</p>
          <form class="wd-pair"><input name="code" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC123" aria-label="Pair code"><button type="submit">Pair</button><button type="button" class="wd-unpair">Disconnect</button></form>
        </section>
        <section>
          <strong>Bluetooth heart-rate sensor</strong>
          <p>Any chest strap, or a watch in heart-rate broadcast mode, straight to this browser (Chrome or Edge). Heart rate only.</p>
          <button type="button" class="wd-ble">Connect over Bluetooth</button>
        </section>
        <p class="wd-note">Readings without a live source stay simulated. Not a medical device.</p>
        <button type="button" class="wd-close">Close</button>`;
      document.body.appendChild(dlg);
      const msg = dlg.querySelector(".wd-status");
      dlg.querySelector(".wd-pair").onsubmit = (e) => {
        e.preventDefault();
        msg.textContent = pair(e.target.code.value) ? "Paired. Waiting for the first reading…" : "The code is 6 letters or digits, shown on the device.";
      };
      dlg.querySelector(".wd-unpair").onclick = () => { unpair(); disconnectBluetooth(); };
      dlg.querySelector(".wd-ble").onclick = async () => {
        msg.textContent = "Pick the sensor in the browser's list…";
        try { msg.textContent = `Connected to ${await connectBluetooth()}.`; }
        catch (err) { msg.textContent = err.name === "NotFoundError" ? "No sensor picked. Is it broadcasting heart rate?" : err.message; }
      };
      dlg.querySelector(".wd-close").onclick = () => dlg.close();
      onChange(refreshDialog);
    }
    refreshDialog();
    dlg.showModal();
  }
  function refreshDialog() {
    if (!dlg) return;
    const s = status();
    dlg.querySelector(".wd-status").textContent = s.live ? `Live from ${s.device}.`
      : s.waiting ? `Paired with code ${s.code}. Waiting for data… (is the device's app open and its phone nearby?)` : "No sensor connected. Showing simulated readings.";
    dlg.querySelector(".wd-unpair").hidden = !s.code && !s.bluetoothName;
    if (s.code) dlg.querySelector("input").value = s.code;
  }

  return { get, status, extras, onChange, openDialog, pair, unpair, connectBluetooth, disconnectBluetooth, label: (id) => LABEL[id] || "watch", hasBluetooth: () => !!navigator.bluetooth };
})();
