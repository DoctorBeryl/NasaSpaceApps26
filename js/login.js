/* ==========================================================
   AstraSight: sign-in page (login.html)

   Two methods, chosen on the first visit (and remembered):
   - Face scan: face-api.js (@vladmandic fork, MIT) runs in the
     browser and turns camera frames into 128-number descriptors.
     Only descriptors go to the server (server/auth.js), which
     keeps them on this machine. The camera starts only after the
     user picks face scan and has seen the demo-only notice.
       sign-in: 3 frontal samples + 1 slight head turn -> /verify
       enroll:  name + 4 frontal + 2 per side          -> /enroll
   - Email and password: Firebase Email/Password (js/auth.js).
   ========================================================== */
(function () {
  const LIB = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
  const METHOD_KEY = "astrasight.loginMethod";   // "face" (notice seen) | "password"
  const CENTER = 0.06;      // |yaw| below this counts as facing the lens
  const TURN = 0.11;        // |yaw| above this counts as a head turn
  const STALL_MS = 25000;   // give up if no progress for this long
  const MIN_GAP_MS = 140;   // spacing between accepted samples

  const $ = (id) => document.getElementById(id);
  const video = $("cam"), overlay = $("overlay"), frame = $("scan-frame");
  const statusEl = $("status"), detailEl = $("detail");
  const form = $("enroll-form"), nameInput = $("crew-name");
  const btnRetry = $("btn-retry"), btnNew = $("btn-new"), btnBack = $("btn-back");
  const ringArc = $("ring-arc");
  const RING_LEN = 2 * Math.PI * 48;
  const params = new URLSearchParams(location.search);

  let faceapi = null, detectorOpts = null, stream = null, run = 0, modelsLoading = null;

  const remember = {
    get() { try { return localStorage.getItem(METHOD_KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(METHOD_KEY, v); } catch { /* private mode */ } },
  };

  /* ---------------- views ---------------- */
  function showView(name) {
    for (const v of ["choose", "face", "password", "signed"]) $(`view-${v}`).hidden = v !== name;
    if (name !== "face") { run++; stopCamera(); }   // leaving the scan: cancel it and release the camera
  }

  function nextUrl(isNew) {
    // New crew always go through the onboarding questionnaire first, even if a page sent them here
    if (isNew) return "interface.html?welcome=1";
    const n = params.get("next");
    if (n && /^[\w-]+\.html(\?[^#<>"']*)?$/.test(n) && !/^login\.html/.test(n)) return n;
    return isNew ? "interface.html?welcome=1" : "interface.html";
  }

  /* ---------------- face: UI helpers ---------------- */
  function say(main, detail = "", tone = "") {
    statusEl.textContent = main;
    detailEl.textContent = detail;
    frame.dataset.tone = tone;
  }
  function progress(f) {
    ringArc.style.strokeDashoffset = String(RING_LEN * (1 - Math.max(0, Math.min(1, f))));
  }
  function stepState(key, state) {
    const el = document.querySelector(`.scan-steps [data-step="${key}"]`);
    if (el) el.dataset.state = state;
  }
  function setSteps(labels) {
    $("scan-steps").innerHTML = labels.map(([k, l]) => `<li data-step="${k}" data-state="todo"><span class="dot"></span>${l}</li>`).join("");
  }
  function controls({ retry = false, newCrew = false, back = false, enroll = false } = {}) {
    btnRetry.hidden = !retry;
    btnNew.hidden = !newCrew;
    btnBack.hidden = !back;
    form.hidden = !enroll;
  }

  /* ---------------- face: camera + models ---------------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load the face-recognition library. Check the network connection."));
      document.head.appendChild(s);
    });
  }

  async function loadModels(url) {
    if (faceapi) return;
    await loadScript(LIB);
    const api = window.faceapi;
    await api.tf.ready();
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(url),
      api.nets.faceLandmark68Net.loadFromUri(url),
      api.nets.faceRecognitionNet.loadFromUri(url),
    ]);
    detectorOpts = new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    // The first pass compiles the GPU shaders (1–3 s on a laptop, longer without a GPU). Do it before prompting.
    say("Calibrating the lens…", "Only the first time you open this page.", "busy");
    await api.detectSingleFace(video, detectorOpts).withFaceLandmarks().withFaceDescriptor();
    faceapi = api;
  }

  async function startCamera() {
    if (stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("This browser can't use the camera here. Open the site on localhost in Chrome or Edge."), { code: "nocam" });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      const denied = e.name === "NotAllowedError" || e.name === "SecurityError";
      throw Object.assign(new Error(denied
        ? "Camera access was blocked. Allow the camera in the address bar, then try again."
        : "No camera found. Connect one, then try again."), { code: "nocam" });
    }
    if ($("view-face").hidden) { stopCamera(); throw Object.assign(new Error("cancelled"), { code: "cancelled" }); }
    video.srcObject = stream;
    await video.play();
    frame.classList.add("live");
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    frame.classList.remove("live");
    clearOverlay();
  }

  /* ---------------- face: per-frame analysis ---------------- */
  /** Head yaw from 68 landmarks: nose tip (30) relative to the jaw ends (0, 16). ~0 when facing the lens. */
  function yawOf(landmarks) {
    const p = landmarks.positions, l = p[0], r = p[16], n = p[30];
    const w = r.x - l.x;
    return w > 0 ? (n.x - (l.x + r.x) / 2) / w : 0;
  }

  function clearOverlay() {
    overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  }

  function draw(results, good) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (overlay.width !== vw) { overlay.width = vw; overlay.height = vh; }
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, vw, vh);
    const color = good ? "#4dffb0" : "#5ef2ff";
    for (const r of results) {
      const { x, y, width: w, height: h } = r.detection.box;
      const c = Math.min(w, h) * 0.22;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        ctx.moveTo(cx, cy + dy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * c, cy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.globalAlpha = 0.7;
      for (const pt of r.landmarks.positions) ctx.fillRect(pt.x - 1.2, pt.y - 1.2, 2.4, 2.4);
      ctx.globalAlpha = 1;
    }
  }

  async function sample() {
    const results = await faceapi.detectAllFaces(video, detectorOpts).withFaceLandmarks().withFaceDescriptors();
    if (!results.length) { draw(results, false); return { state: "none" }; }
    if (results.length > 1) { draw(results, false); return { state: "many" }; }
    const r = results[0];
    if (r.detection.box.width < video.videoWidth * 0.16) { draw(results, false); return { state: "far" }; }
    draw(results, true);
    const yaw = yawOf(r.landmarks);
    frame.dataset.yaw = yaw.toFixed(3);   // handy when tuning CENTER / TURN
    return { state: "ok", descriptor: Array.from(r.descriptor), yaw };
  }

  const FRAME_HINT = {
    none: "I can't see a face. Move into the frame.",
    many: "I can see more than one face. One person at a time.",
    far: "Move a little closer to the lens.",
  };

  /**
   * Collect descriptors until every step has `need` samples.
   * Steps: { key, need, prompt, test(yaw, ctx) } — ctx.side remembers which way the first turn went.
   */
  async function capture(steps, myRun) {
    const got = Object.fromEntries(steps.map((s) => [s.key, []]));
    const total = steps.reduce((n, s) => n + s.need, 0);
    const ctx = { side: 0 };
    let lastProgress = Date.now(), lastAccept = 0;
    steps.forEach((s) => stepState(s.key, "todo"));
    progress(0);

    while (true) {
      if (myRun !== run) throw cancelled();
      const current = steps.find((s) => got[s.key].length < s.need);
      if (!current) break;
      stepState(current.key, "active");

      const f = await sample();
      if (myRun !== run) throw cancelled();
      if (f.state !== "ok") {
        say(current.prompt, FRAME_HINT[f.state]);
      } else {
        say(current.prompt, "");
        const now = Date.now();
        // Fill the prompted step first; an early head turn still counts toward a later turn step.
        const target = [current, ...steps].find((s) => got[s.key].length < s.need && s.test(f.yaw, ctx));
        if (target && now - lastAccept > MIN_GAP_MS) {
          if (target.turn && !ctx.side) ctx.side = Math.sign(f.yaw);
          got[target.key].push(f.descriptor);
          lastAccept = lastProgress = now;
          if (got[target.key].length >= target.need) stepState(target.key, "done");
          progress(Object.values(got).reduce((n, a) => n + a.length, 0) / total);
        }
      }
      if (Date.now() - lastProgress > STALL_MS) {
        throw Object.assign(new Error("I couldn't get a clear look. Face a light source, remove anything covering your face, and try again."), { code: "stall" });
      }
      // Let the browser paint (overlay, prompt) before the next GPU-heavy pass, or slow GPUs freeze the page.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    }
    return steps.flatMap((s) => got[s.key]);
  }

  const facing = (yaw) => Math.abs(yaw) < CENTER;
  const LOGIN_STEPS = [
    { key: "face", need: 3, prompt: "Look straight into the lens.", test: facing },
    { key: "turn", need: 1, turn: true, prompt: "Now turn your head slightly to either side.", test: (y) => Math.abs(y) > TURN },
  ];
  const ENROLL_STEPS = [
    { key: "face", need: 4, prompt: "Look straight into the lens and hold still.", test: facing },
    { key: "side1", need: 2, turn: true, prompt: "Turn your head slightly to one side.", test: (y) => Math.abs(y) > TURN },
    { key: "side2", need: 2, turn: true, prompt: "Now turn slightly to the other side.", test: (y, c) => Math.abs(y) > TURN && c.side && Math.sign(y) !== c.side },
  ];

  /* ---------------- face: server ---------------- */
  async function post(url, body) {
    const r = await fetch(AstraAuth.api(url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let data = {};
    try { data = await r.json(); } catch { /* empty */ }
    return { ok: r.ok, status: r.status, data };
  }

  /* ---------------- face: flows ---------------- */
  const cancelled = () => Object.assign(new Error("cancelled"), { code: "cancelled" });

  async function prepare(flow) {
    const cfg = AstraAuth.config;
    if (!cfg || cfg.mode === "unavailable") {
      throw Object.assign(new Error("Face sign-in needs the AstraSight server, and it isn't running. Start it with  npm run dev  (or node server.js), then try again."), { code: "noserver" });
    }
    say("Starting the lens camera…", "", "busy");
    await startCamera();
    if (flow !== run) throw cancelled();
    if (!faceapi) {
      say("Loading face recognition…", "About 7 MB the first time, then it's cached.", "busy");
      modelsLoading = modelsLoading || loadModels(cfg.faceModels).catch((e) => { modelsLoading = null; throw e; });
      await modelsLoading;
      if (flow !== run) throw cancelled();
    }
  }

  function startFace() {
    remember.set("face");
    showView("face");
    if (params.has("enroll")) return askName("New crew member? Tell me your name or call sign.");
    if (AstraAuth.config?.enrolled === 0) return askName("No crew are enrolled on this device yet. Tell me your name to enroll.");
    signIn();
  }

  async function signIn() {
    const flow = ++run;   // switching view or method bumps `run`, which cancels this flow
    controls({ newCrew: true });
    setSteps([["face", "Face"], ["turn", "Turn"], ["match", "Match"]]);
    try {
      await prepare(flow);
      const descriptors = await capture(LOGIN_STEPS, flow);
      stepState("match", "active");
      say("Checking your face…", "", "busy");
      const res = await post("/api/auth/face/verify", { descriptors });
      if (res.ok) return finishFace(res.data);
      if (res.status === 401) {
        stepState("match", "fail");
        return askName("I don't recognize you. If you're new, tell me your name.");
      }
      throw new Error(res.data.message || "Sign-in failed.");
    } catch (e) {
      fail(e);
    }
  }

  function askName(message) {
    run++;   // stop any running capture
    say(message, "Then I'll take about ten seconds to learn your face.");
    progress(0);
    setSteps([]);
    controls({ enroll: true, back: AstraAuth.config?.enrolled > 0 });
    setTimeout(() => nameInput.focus(), 50);
  }

  async function enroll(name) {
    const flow = ++run;
    controls({ back: true });
    setSteps([["face", "Face"], ["side1", "Side"], ["side2", "Other side"]]);
    try {
      await prepare(flow);
      const descriptors = await capture(ENROLL_STEPS, flow);
      say("Saving your face template on this device…", "", "busy");
      let res = await post("/api/auth/face/enroll", { name, descriptors });
      if (res.status === 409) {
        say(`You're already enrolled as ${res.data.name}. Signing you in.`, "", "busy");
        res = await post("/api/auth/face/verify", { descriptors: descriptors.slice(0, 4) });
      }
      if (res.ok) return finishFace(res.data);
      throw new Error(res.data.message || "Enrollment failed.");
    } catch (e) {
      fail(e);
    }
  }

  async function finishFace(session) {
    progress(1);
    stopCamera();
    try {
      await AstraAuth.signInWithSession(session);
    } catch (e) {
      return fail(new Error(`Face matched, but Firebase sign-in failed: ${e.message}`));
    }
    say(session.isNew ? `Welcome aboard, ${session.name}.` : `Welcome back, ${session.name}.`,
      session.isNew ? "Next: a short tour and a few questions so VEGA knows your baseline." : "Opening your lens…", "ok");
    controls();
    setTimeout(() => location.assign(nextUrl(session.isNew)), session.isNew ? 1800 : 1200);
  }

  function fail(e) {
    if (e.code === "cancelled") return;
    run++;
    stopCamera();
    progress(0);
    say(e.code === "nocam" || e.code === "noserver" ? "Face sign-in isn't available." : "That didn't work.", e.message, "fail");
    noServer = e.code === "noserver";
    controls({ retry: true, newCrew: e.code === "stall" });
  }

  // After "server not running", Try again reloads so auth.js looks for the server again.
  let noServer = false;
  btnRetry.onclick = () => (noServer ? location.reload() : signIn());
  btnBack.onclick = () => signIn();
  btnNew.onclick = () => askName("New crew member? Tell me your name or call sign.");
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    enroll(name);
  };

  /* ---------------- email and password ---------------- */
  const pwForm = $("pw-form"), pwMsg = $("pw-msg"), pwSubmit = $("pw-submit");
  const pwName = $("pw-name"), pwEmail = $("pw-email"), pwPass = $("pw-pass");
  let pwMode = "signin";

  const PW_ERRORS = {
    "auth/invalid-credential": "Email or password is wrong.",
    "auth/wrong-password": "Email or password is wrong.",
    "auth/user-not-found": "Email or password is wrong.",
    "auth/invalid-email": "That email address isn't valid.",
    "auth/missing-password": "Enter your password.",
    "auth/email-already-in-use": "There's already an account with this email. Sign in instead.",
    "auth/weak-password": "Use a password of at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/network-request-failed": "Can't reach Firebase. Check the network connection.",
    "auth/operation-not-allowed": "Email and password sign-in isn't turned on for this Firebase project yet.",
    "auth/configuration-not-found": "Firebase Authentication isn't set up for this project yet.",
  };

  function pwSay(text, tone = "") {
    pwMsg.textContent = text;
    pwMsg.dataset.tone = tone;
  }

  function setPwMode(mode) {
    pwMode = mode;
    document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
    pwForm.querySelectorAll("[data-only=create]").forEach((el) => { el.hidden = mode !== "create"; });
    pwSubmit.textContent = mode === "create" ? "Create account" : "Sign in";
    pwPass.autocomplete = mode === "create" ? "new-password" : "current-password";
    $("pw-forgot").hidden = mode === "create";
    pwSay("");
  }

  function startPassword() {
    remember.set("password");
    showView("password");
    setTimeout(() => (pwMode === "create" ? pwName : pwEmail).focus(), 50);
  }

  pwForm.onsubmit = async (ev) => {
    ev.preventDefault();
    const name = pwName.value.trim(), email = pwEmail.value.trim(), pass = pwPass.value;
    if (pwMode === "create" && !name) return pwSay("Enter a name or call sign.", "fail"), pwName.focus();
    if (!email) return pwSay("Enter your email.", "fail"), pwEmail.focus();
    if (!pass) return pwSay("Enter your password.", "fail"), pwPass.focus();
    pwSubmit.disabled = true;
    pwSay(pwMode === "create" ? "Creating your account…" : "Signing in…");
    try {
      const u = pwMode === "create"
        ? await AstraAuth.createAccount(name, email, pass)
        : await AstraAuth.signInWithPassword(email, pass);
      const isNew = pwMode === "create";
      pwSay(isNew ? `Welcome aboard, ${u.name}.` : `Welcome back, ${u.name}.`, "ok");
      setTimeout(() => location.assign(nextUrl(isNew)), isNew ? 1500 : 900);
    } catch (e) {
      pwSay(PW_ERRORS[e.code] || e.message, "fail");
      pwSubmit.disabled = false;
    }
  };

  $("pw-forgot").onclick = async () => {
    const email = pwEmail.value.trim();
    if (!email) return pwSay("Enter your email first, then choose \"Forgot password?\".", "fail"), pwEmail.focus();
    try {
      await AstraAuth.resetPassword(email);
      pwSay(`If there's an account for ${email}, a reset link is on its way.`, "ok");
    } catch (e) {
      pwSay(PW_ERRORS[e.code] || e.message, "fail");
    }
  };

  document.querySelectorAll(".seg [data-mode]").forEach((b) => { b.onclick = () => setPwMode(b.dataset.mode); });

  /* ---------------- wire up ---------------- */
  $("pick-face").onclick = startFace;
  $("pick-password").onclick = startPassword;
  $("to-password").onclick = startPassword;
  $("to-face").onclick = startFace;
  const toChoose = () => { remember.set(""); showView("choose"); };
  $("face-to-choose").onclick = toChoose;
  $("pw-to-choose").onclick = toChoose;

  AstraAuth.ready.then((u) => {
    const passwordOk = AstraAuth.config?.mode === "firebase";
    $("pick-password").disabled = !passwordOk;
    $("password-off").hidden = passwordOk;
    $("to-password").hidden = !passwordOk;

    if (u) {
      $("signed-text").textContent = `You're signed in as ${u.name}.`;
      $("btn-continue").href = nextUrl(false);
      $("btn-switch").onclick = async () => { await AstraAuth.signOut(); showView("choose"); };
      return showView("signed");
    }
    const last = remember.get();
    if (last === "face") return startFace();             // notice already seen; it stays visible under the camera
    if (last === "password" && passwordOk) return startPassword();
    showView("choose");
  });

  addEventListener("pagehide", stopCamera);
})();
