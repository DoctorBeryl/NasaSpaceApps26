/* ==========================================================
   AstraSight — 3D EVA helmet on the home page (three.js r160, UMD build)
   (File keeps its old glasses3d.js name so nothing else breaks.)
   Procedural model, no asset files: helmet shell, dark visor with the
   mini health display built into it, ear modules with the two buttons
   and the scroll knob, neck ring. Callout arrows follow the left
   button, right button, scroll knob and visor display as it turns.
   "Left" and "right" are the wearer's: the wearer looks along +z,
   so their right side sits at -x.
   ========================================================== */
(function () {
  const stage = document.getElementById("glasses-stage");
  if (!stage) return;
  const canvas = stage.querySelector("canvas");
  const svg = stage.querySelector("svg.g3d-lines");
  if (!window.THREE || !canvas) { stage.classList.add("g3d-fallback"); return; }

  const css = getComputedStyle(document.documentElement);
  const cssVar = (n, d) => (css.getPropertyValue(n) || d).trim() || d;
  const tok = (n, d) => new THREE.Color(cssVar(n, d));
  const C = {
    frame: tok("--surface-solid", "#0e1428"), cyan: tok("--cyan", "#5ef2ff"),
    violet: tok("--violet", "#8f7cff"), magenta: tok("--magenta", "#ff6ad5"),
    shell: tok("--text", "#e8eeff"),
  };
  // One color per control, shared by the 3D highlight, the arrow and the label (--c on each callout)
  const calloutEls = [...stage.querySelectorAll("[data-target]")];
  const ctrlColor = {};
  calloutEls.forEach((el) => { ctrlColor[el.dataset.target] = (getComputedStyle(el).getPropertyValue("--c") || "").trim() || "#5ef2ff"; });
  const ctrl3d = (k) => new THREE.Color(ctrlColor[k] || "#5ef2ff");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 5, 4); scene.add(key);
  const rimC = new THREE.PointLight(C.cyan, 22, 12); rimC.position.set(-3, 1.5, 2.5); scene.add(rimC);
  const rimV = new THREE.PointLight(C.violet, 26, 12); rimV.position.set(3, -1, -3); scene.add(rimV);

  const shellMat = new THREE.MeshStandardMaterial({ color: C.shell.clone().multiplyScalar(0.85), metalness: 0.15, roughness: 0.5 });
  const frameMat = new THREE.MeshStandardMaterial({ color: C.frame.clone().multiplyScalar(1.8), metalness: 0.7, roughness: 0.32 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: C.frame.clone().multiplyScalar(1.3), emissive: C.cyan, emissiveIntensity: 0.04, metalness: 0.6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glowMat = (c, o = 0.9) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, transparent: o < 1, opacity: o, metalness: 0.2, roughness: 0.4 });
  const neutralGlow = glowMat(C.frame.clone().lerp(new THREE.Color("#ffffff"), 0.35), 0.6);   // neutral, so control colors stand out

  const helmet = new THREE.Group();
  scene.add(helmet);

  // Point on a sphere of radius r: phi runs around the vertical axis (phi = PI/2 faces forward, +z),
  // theta from the top. Same convention as THREE.SphereGeometry.
  const P = (r, phi, theta) => new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
  const FWD = Math.PI / 2;

  /* Shell */
  const R = 1.2;
  helmet.add(new THREE.Mesh(new THREE.SphereGeometry(R, 56, 40), shellMat));

  /* Visor: a dark curved window across the front */
  const V = { p0: FWD - 0.95, p1: FWD + 0.95, t0: 0.95, t1: 2.0 };
  helmet.add(new THREE.Mesh(new THREE.SphereGeometry(R + 0.012, 48, 24, V.p0, V.p1 - V.p0, V.t0, V.t1 - V.t0), visorMat));
  // Raised frame around the visor
  const edge = [], N = 20, ER = R + 0.022;
  for (let i = 0; i < N; i++) edge.push(P(ER, V.p0 + (V.p1 - V.p0) * i / N, V.t0));
  for (let i = 0; i < N; i++) edge.push(P(ER, V.p1, V.t0 + (V.t1 - V.t0) * i / N));
  for (let i = 0; i < N; i++) edge.push(P(ER, V.p1 - (V.p1 - V.p0) * i / N, V.t1));
  for (let i = 0; i < N; i++) edge.push(P(ER, V.p0, V.t1 - (V.t1 - V.t0) * i / N));
  helmet.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true, "centripetal"), 240, 0.04, 8, true), frameMat));

  /* Mini display built into the visor, on the wearer's right (-x), so the centre of view stays clear */
  const D = { p0: FWD - 0.82, p1: FWD - 0.36, t0: 1.15, t1: 1.75 };
  const tex = document.createElement("canvas"); tex.width = 256; tex.height = 336;
  const tctx = tex.getContext("2d");
  const texture = new THREE.CanvasTexture(tex);
  texture.colorSpace = THREE.SRGBColorSpace;
  const hudCol = { cyan: cssVar("--cyan", "#5ef2ff"), ok: cssVar("--ok", "#4dffb0"), warn: cssVar("--warn", "#ffc65c"), dim: cssVar("--text-dim", "#9aa6c8") };
  const mono = cssVar("--mono", "monospace");
  const trace = Array.from({ length: 40 }, () => 0.5);
  function drawDisplay() {
    const g = tctx, w = tex.width, h = tex.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(4, 10, 20, 0.82)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = hudCol.cyan; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = hudCol.cyan; g.font = `bold 22px ${mono}`; g.fillText("ASTRA // VITALS", 16, 38);
    const hr = Math.round(70 + Math.random() * 5);
    const rows = [["HEART", `${hr}`, hudCol.ok], ["SpO2", "97.6", hudCol.ok], ["RESP", "15", hudCol.ok], ["DOSE", "0.62", hudCol.warn]];
    rows.forEach(([k, val, c], i) => {
      const y = 86 + i * 44;
      g.fillStyle = hudCol.dim; g.font = `22px ${mono}`; g.fillText(k, 16, y);
      g.fillStyle = c; g.font = `bold 30px ${mono}`; g.textAlign = "right"; g.fillText(val, w - 16, y); g.textAlign = "left";
    });
    // ECG-style trace along the bottom
    trace.shift(); trace.push(Math.random() < 0.12 ? 0.05 : 0.45 + Math.random() * 0.15);
    g.strokeStyle = hudCol.ok; g.lineWidth = 4; g.beginPath();
    trace.forEach((t, i) => { const x = 16 + i * (w - 32) / (trace.length - 1), y = 270 + t * 50; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    texture.needsUpdate = true;
  }
  drawDisplay();
  if (!reduced) setInterval(drawDisplay, 900);
  const display = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.018, 16, 12, D.p0, D.p1 - D.p0, D.t0, D.t1 - D.t0),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.95, toneMapped: false }),
  );
  helmet.add(display);
  const anchors = {};
  anchors.display = new THREE.Object3D(); anchors.display.position.copy(P(R + 0.02, (D.p0 + D.p1) / 2, (D.t0 + D.t1) / 2)); helmet.add(anchors.display);

  /* Ridge over the top, from the back to just above the visor */
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(R + 0.005, 0.05, 10, 64, Math.PI - 0.72), frameMat);
  ridge.rotation.y = Math.PI / 2; helmet.add(ridge);

  /* Helmet lamps on the upper front corners */
  [-1, 1].forEach((side) => {
    const n = new THREE.Vector3(side * 0.62, 0.62, 0.48).normalize();
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.16), frameMat);
    lamp.position.copy(n.clone().multiplyScalar(R + 0.04)); lamp.lookAt(n.clone().multiplyScalar(5)); helmet.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), neutralGlow);
    lens.position.copy(n.clone().multiplyScalar(R + 0.125)); lens.lookAt(n.clone().multiplyScalar(5)); helmet.add(lens);
  });

  /* Ear modules: the two buttons sit on top, the scroll knob on the right one's outer face */
  const EY = -0.02, EZ = -0.08, EX = 1.18, ER2 = 0.3, EW = 0.16;
  [-1, 1].forEach((side) => {
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(ER2, ER2, EW, 40), frameMat);
    mod.rotation.z = Math.PI / 2; mod.position.set(side * EX, EY, EZ); helmet.add(mod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ER2 - 0.03, 0.012, 8, 40), neutralGlow);
    ring.rotation.y = Math.PI / 2; ring.position.set(side * (EX + EW / 2 + 0.002), EY, EZ); helmet.add(ring);

    const name = side === 1 ? "left" : "right";
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 12), glowMat(ctrl3d(name)));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(side * EX, EY + ER2 + 0.025, EZ); helmet.add(btn);
    const a = new THREE.Object3D(); a.position.set(side * EX, EY + ER2 + 0.08, EZ); helmet.add(a);
    anchors[name] = a;
  });

  // Scroll knob: a ribbed crown on the outer face of the right ear module (-x), joined by a short axle
  const KR = 0.11, KW = 0.07, AX = 0.035;              // knob radius, knob width, axle length
  const modOuter = -(EX + EW / 2);                      // outer face of the right module
  const knobX = modOuter - AX - KW / 2;
  const knob = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: C.frame.clone().multiplyScalar(3), metalness: 0.85, roughness: 0.25, flatShading: true });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(KR, KR, KW, 24), metal);
  wheel.rotation.z = Math.PI / 2; knob.add(wheel);
  for (let i = 0; i < 12; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(KW + 0.006, 0.018, 0.022), frameMat);
    const t = (i / 12) * Math.PI * 2;
    rib.position.set(0, Math.cos(t) * (KR + 0.004), Math.sin(t) * (KR + 0.004)); rib.rotation.x = -t; knob.add(rib);
  }
  const knobGlow = glowMat(ctrl3d("knob"));
  [-1, 1].forEach((s) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(KR, 0.01, 8, 28), knobGlow);
    ring.rotation.y = Math.PI / 2; ring.position.x = s * (KW / 2 - 0.004); knob.add(ring);
  });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(KR * 0.45, 20), knobGlow);   // lit centre on the outer face
  cap.rotation.y = -Math.PI / 2; cap.position.x = -KW / 2 - 0.002; knob.add(cap);
  knob.position.set(knobX, EY, EZ); helmet.add(knob);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, AX + 0.01, 16), frameMat);
  axle.rotation.z = Math.PI / 2; axle.position.set(modOuter - AX / 2 + 0.005, EY, EZ); helmet.add(axle);
  anchors.knob = new THREE.Object3D(); anchors.knob.position.set(knobX - KW / 2, EY, EZ); helmet.add(anchors.knob);

  /* Neck ring that locks onto the suit */
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.085, 16, 56), frameMat);
  neck.rotation.x = Math.PI / 2; neck.position.y = -0.98; helmet.add(neck);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.92, 0.24, 56), frameMat);
  collar.position.y = -1.16; helmet.add(collar);
  const collarGlow = new THREE.Mesh(new THREE.TorusGeometry(0.885, 0.012, 8, 56), neutralGlow);
  collarGlow.rotation.x = Math.PI / 2; collarGlow.position.y = -1.08; helmet.add(collarGlow);

  const CENTER = new THREE.Vector3(0, 0.05, -0.7);
  helmet.position.copy(CENTER);

  /* Callouts: SVG arrows from each label to its projected anchor */
  const NS = "http://www.w3.org/2000/svg";
  const defs = svg.querySelector("defs"), baseMarker = svg.querySelector("#g3d-arrow");
  const callouts = calloutEls.map((el) => {
    const color = ctrlColor[el.dataset.target];
    const marker = baseMarker.cloneNode(true);          // one arrowhead per color (markers can't inherit stroke)
    marker.id = `g3d-arrow-${el.dataset.target}`;
    marker.querySelector("path").style.fill = color;
    defs.appendChild(marker);
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "g3d-line"); line.setAttribute("marker-end", `url(#${marker.id})`);
    line.style.stroke = color; svg.appendChild(line);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", "4"); dot.setAttribute("class", "g3d-dot");
    dot.style.fill = color; dot.style.filter = `drop-shadow(0 0 6px ${color})`; svg.appendChild(dot);
    return { el, line, dot, anchor: anchors[el.dataset.target] };
  }).filter((c) => c.anchor);
  const v = new THREE.Vector3();
  function drawCallouts(w, h) {
    const box = stage.getBoundingClientRect();
    callouts.forEach((c) => {
      c.anchor.getWorldPosition(v).project(camera);
      const tx = (v.x + 1) / 2 * w, ty = (1 - v.y) / 2 * h;
      const r = c.el.getBoundingClientRect();
      const onLeft = r.left + r.width / 2 < box.left + w / 2;
      const sx = (onLeft ? r.right : r.left) - box.left, sy = r.top + r.height / 2 - box.top;
      const mx = sx + (onLeft ? 24 : -24);
      // Stop short of the target so the arrowhead tip lands on it
      const dx = tx - mx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
      const ex = tx - dx / len * 10, ey = ty - dy / len * 10;
      c.line.setAttribute("d", `M${sx},${sy} L${mx},${sy} L${ex},${ey}`);
      c.dot.setAttribute("cx", tx); c.dot.setAttribute("cy", ty);
    });
  }

  /* Drag to rotate; gentle sway when idle */
  let yaw = 0.62, pitch = 0, dragging = false, lastX = 0, lastY = 0, idle = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); stage.classList.add("dragging"); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-0.5, Math.min(0.6, pitch + (e.clientY - lastY) * 0.006));
    lastX = e.clientX; lastY = e.clientY; idle = 0;
  });
  const end = () => { dragging = false; stage.classList.remove("dragging"); };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  let w = 0, h = 0;
  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on narrow screens so the whole helmet stays in frame
    const d = 7 * Math.max(1, 1.2 / camera.aspect);
    camera.position.set(0, 1.7 * d / 7, d - 0.7);
    camera.lookAt(CENTER.x, CENTER.y - 0.1, CENTER.z);
    camera.updateProjectionMatrix();
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  addEventListener("resize", resize); resize();

  let visible = true, t0 = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (!dragging) idle += dt;
    const sway = reduced || idle < 2 ? 0 : Math.sin(now / 2600) * 0.25 * Math.min(1, (idle - 2) / 2);
    helmet.rotation.set(0.1 + pitch, yaw + sway, 0);
    if (!reduced) knob.rotation.x = now / 900;   // knob turns slowly, hinting it scrolls
    renderer.render(scene, camera);
    drawCallouts(w, h);
  }
  requestAnimationFrame(frame);
})();
