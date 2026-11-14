/* ==========================================================
   AstraSight: client auth (window.AstraAuth)
   Load after common.js on every page. Face matching happens on
   login.html (js/login.js); this file holds the session and the
   crew profile, for any page or feature that needs them.

   await AstraAuth.ready                 -> user | null
   AstraAuth.user                        { uid, name, mode }  (mode: "firebase" | "local")
   AstraAuth.requireAuth()               redirect to login.html if signed out
   AstraAuth.onChange(fn)                fn(user) on sign-in / sign-out
   await AstraAuth.getProfile()          { name, createdAt, lastLoginAt, onboarded, profile, ... }
   await AstraAuth.saveProfile(patch)    shallow-merge into the profile doc
   await AstraAuth.needsOnboarding()     true until saveProfile({ onboarded: true })
   await AstraAuth.getIdToken()          Firebase ID token (null in local mode)
   await AstraAuth.signOut()
   (login.js only) signInWithSession(s), signInWithPassword(email, pw),
   createAccount(name, email, pw), resetPassword(email)

   Firebase mode stores the profile in Firestore at users/{uid}
   (rules: firestore.rules). Local mode, or Firestore being
   unreachable, falls back to localStorage. See docs/AUTH.md.
   ========================================================== */
(function () {
  const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  const LOCAL_SESSION = "astrasight.session";
  const LOCAL_PROFILE = (uid) => `astrasight.profile.${uid}`;
  const FIRESTORE_TIMEOUT = 4000;

  let cfg = null;      // /api/auth/config
  let fb = null;       // { auth, db, a: auth module, f: firestore module }
  let user = null;
  const listeners = new Set();

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  function withTimeout(p, ms = FIRESTORE_TIMEOUT) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  function setUser(u) {
    user = u;
    renderNavChip();
    document.querySelectorAll("[data-auth-name]").forEach((el) => {
      if (!el.dataset.authDefault) el.dataset.authDefault = el.textContent;
      el.textContent = u ? u.name.toUpperCase() : el.dataset.authDefault;
    });
    listeners.forEach((fn) => { try { fn(u); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("astra:auth", { detail: u }));
  }

  /* API base: this page's own origin when it's served by server.js, otherwise node server.js on
     localhost:8000 (so pages from npx serve / Live Server still get sign-in and VEGA's AI). */
  const API_FALLBACK = "http://localhost:8000";
  let apiBase = "";
  async function loadConfig() {
    const bases = location.protocol.startsWith("http") ? [""] : [];
    if (location.origin !== API_FALLBACK) bases.push(API_FALLBACK);
    for (const base of bases) {
      try {
        const r = await fetch(base + "/api/auth/config", { cache: "no-store" });
        if (r.ok) { apiBase = base; return await r.json(); }
      } catch { /* static server: no API here */ }
    }
    return { mode: "unavailable", firebase: null };
  }

  async function initFirebase() {
    const [app, a, f] = await Promise.all([
      import(FB + "firebase-app.js"),
      import(FB + "firebase-auth.js"),
      import(FB + "firebase-firestore.js"),
    ]);
    const fbApp = app.initializeApp(cfg.firebase);
    fb = { a, f, auth: a.getAuth(fbApp), db: f.getFirestore(fbApp) };
    // Default persistence is IndexedDB (survives reloads); fine for a shared demo laptop with sign-out.
    const first = await new Promise((resolve) => {
      const off = a.onAuthStateChanged(fb.auth, (u) => { off(); resolve(u); });
    });
    a.onAuthStateChanged(fb.auth, (u) => {
      if ((u && u.uid) === (user && user.uid)) return;
      setUser(u ? fromFirebase(u) : null);
    });
    return first ? fromFirebase(first) : null;
  }

  function fromFirebase(u) {
    return { uid: u.uid, name: u.displayName || (store.get(LOCAL_SESSION) || {}).name || "Crew", mode: "firebase" };
  }

  async function init() {
    cfg = await loadConfig();
    let u = null;
    if (cfg.mode === "firebase") {
      try { u = await initFirebase(); } catch (e) { console.warn("[auth] Firebase failed to load; using local session.", e); cfg.mode = "local"; }
    }
    if (!u && cfg.mode !== "firebase") u = store.get(LOCAL_SESSION);
    setUser(u && u.uid ? u : null);
    return user;
  }

  /* ---------- profile (Firestore, with a localStorage fallback) ---------- */
  async function getProfile() {
    if (!user) return null;
    const local = store.get(LOCAL_PROFILE(user.uid));
    if (user.mode === "firebase" && fb) {
      try {
        const snap = await withTimeout(fb.f.getDoc(fb.f.doc(fb.db, "users", user.uid)));
        if (snap.exists()) {
          const data = snap.data();
          store.set(LOCAL_PROFILE(user.uid), data);   // offline copy
          return data;
        }
      } catch (e) {
        console.warn("[auth] Firestore read failed; using the local copy.", e.message);
      }
    }
    return local;
  }

  async function saveProfile(patch) {
    if (!user) throw new Error("Not signed in");
    const merged = { ...(store.get(LOCAL_PROFILE(user.uid)) || {}), ...patch, updatedAt: new Date().toISOString() };
    store.set(LOCAL_PROFILE(user.uid), merged);
    if (user.mode === "firebase" && fb) {
      try {
        await withTimeout(fb.f.setDoc(fb.f.doc(fb.db, "users", user.uid), { ...patch, updatedAt: merged.updatedAt }, { merge: true }));
      } catch (e) {
        console.warn("[auth] Firestore write failed; saved locally only.", e.message);
      }
    }
    return merged;
  }

  /* ---------- sign-in from a server session (called by login.js) ---------- */
  async function signInWithSession(s) {
    const now = new Date().toISOString();
    if (s.mode === "firebase") {
      if (!fb) throw new Error("Firebase isn't loaded");
      // Name cache only (Firebase holds the session). Set first: onAuthStateChanged may fire before displayName is.
      store.set(LOCAL_SESSION, { uid: s.uid, name: s.name, mode: "firebase" });
      const cred = await fb.a.signInWithCustomToken(fb.auth, s.token);
      if (cred.user.displayName !== s.name) await fb.a.updateProfile(cred.user, { displayName: s.name });
      setUser({ uid: s.uid, name: s.name, mode: "firebase" });
    } else {
      store.set(LOCAL_SESSION, { uid: s.uid, name: s.name, mode: "local" });
      setUser({ uid: s.uid, name: s.name, mode: "local" });
    }
    await saveProfile(s.isNew
      ? { name: s.name, createdAt: now, lastLoginAt: now, onboarded: false }
      : { name: s.name, lastLoginAt: now });
    return user;
  }

  /* ---------- email + password (Firebase Email/Password provider) ---------- */
  function needFirebase() {
    if (!fb) throw Object.assign(new Error("Password sign-in needs Firebase, which isn't set up on this server."), { code: "no-firebase" });
  }

  async function signInWithPassword(email, password) {
    needFirebase();
    const cred = await fb.a.signInWithEmailAndPassword(fb.auth, email, password);
    const name = cred.user.displayName || email.split("@")[0];
    store.set(LOCAL_SESSION, { uid: cred.user.uid, name, mode: "firebase" });
    setUser({ uid: cred.user.uid, name, mode: "firebase" });
    await saveProfile({ name, lastLoginAt: new Date().toISOString() });
    return user;
  }

  async function createAccount(name, email, password) {
    needFirebase();
    store.set(LOCAL_SESSION, { name, mode: "firebase" });   // so the auth listener shows the name before displayName is set
    const cred = await fb.a.createUserWithEmailAndPassword(fb.auth, email, password);
    await fb.a.updateProfile(cred.user, { displayName: name });
    store.set(LOCAL_SESSION, { uid: cred.user.uid, name, mode: "firebase" });
    setUser({ uid: cred.user.uid, name, mode: "firebase" });
    const now = new Date().toISOString();
    await saveProfile({ name, createdAt: now, lastLoginAt: now, onboarded: false });
    return user;
  }

  async function resetPassword(email) {
    needFirebase();
    await fb.a.sendPasswordResetEmail(fb.auth, email);
  }

  async function signOut() {
    if (fb) { try { await fb.a.signOut(fb.auth); } catch { /* ignore */ } }
    store.del(LOCAL_SESSION);
    setUser(null);
  }

  /* ---------- nav chip ---------- */
  function renderNavChip() {
    const links = document.querySelector("#site-nav .nav-links");
    if (!links) return;
    let el = links.querySelector(".nav-auth");
    if (!el) {
      el = document.createElement("span");
      el.className = "nav-auth";
      links.appendChild(el);
    }
    const onLogin = /login\.html$/.test(location.pathname);
    if (user) {
      el.innerHTML = `<span class="chip"><span class="dot"></span><span class="nav-auth-name"></span></span><button type="button" class="nav-auth-out">Sign out</button>`;
      el.querySelector(".nav-auth-name").textContent = user.name;
      el.querySelector(".nav-auth-out").onclick = async () => { await signOut(); location.href = "login.html"; };
    } else {
      el.innerHTML = onLogin ? "" : `<a href="login.html" class="nav-auth-in">Sign in</a>`;
    }
  }

  const ready = (async () => {
    if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
    return init();
  })();

  window.AstraAuth = {
    ready,
    get user() { return user; },
    get config() { return cfg; },
    /** Absolute or same-origin URL for an API path, e.g. AstraAuth.api("/api/ai/chat"). Valid after `ready`. */
    api(path) { return apiBase + path; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getProfile,
    saveProfile,
    async needsOnboarding() { const p = await getProfile(); return !p || !p.onboarded; },
    async getIdToken() { return fb && fb.auth.currentUser ? fb.auth.currentUser.getIdToken() : null; },
    async requireAuth() {
      const u = await ready;
      if (!u && cfg.mode !== "unavailable") {
        location.replace(`login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`);
      }
      return u;
    },
    signInWithSession,
    signInWithPassword,
    createAccount,
    resetPassword,
    signOut,
  };
})();
