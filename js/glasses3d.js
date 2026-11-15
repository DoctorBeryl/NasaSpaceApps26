/* ==========================================================
   AstraSight — 3D EVA helmet in the home page hero (three.js r160, UMD build)
   (File keeps its old glasses3d.js name so nothing else breaks.)
   Procedural model, no asset files, modelled on a spacewalk helmet:
   white hard shell with a rounded visor opening, gold sun visor
   (raised), clear pressure bubble, helmet lights with a camera, visor
   pivot hubs and a metal neck ring. The mini health display is built
   into the visor on the wearer's right. Reflections come from a small
   procedural studio environment (PMREM), so no HDR file is needed.
   No buttons or knobs: gloved hands can't work small controls, so the
   helmet is hands-free. The hero float tags ([data-target]) are the
   callouts: arrows follow the chin microphones,
   inward eye cameras, dosimeter and visor display as it turns. "Left" and "right" are the wearer's: the
   wearer looks along +z, so their right side sits at -x.
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
  };
  // Real-world material colors (not UI colors): suit-white shell, gold-film visor, anodised aluminium
  const REAL = { shell: "#eef0f2", trim: "#cfd4da", gold: "#d9a441", metal: "#b9c0c8", dark: "#15181d", lamp: "#fff4dc" };
  // One color per control, shared by the 3D highlight, the arrow and the label (--c on each callout)
  const calloutEls = [...stage.querySelectorAll("[data-target]")];
  const ctrlColor = {};
  calloutEls.forEach((el) => { ctrlColor[el.dataset.target] = (getComputedStyle(el).getPropertyValue("--c") || "").trim() || "#5ef2ff"; });
  const ctrl3d = (k) => new THREE.Color(ctrlColor[k] || "#5ef2ff");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  /* Studio environment for reflections: dark gradient room, a big soft key light above,
     cyan and violet strips at the sides (the site's colors), a dim floor bounce. */
  {
    const env = new THREE.Scene();
    const room = new THREE.SphereGeometry(10, 32, 16);
    const cols = [], p = room.attributes.position, lo = new THREE.Color("#04070d"), hi = new THREE.Color("#2b3546");
    for (let i = 0; i < p.count; i++) { const c = lo.clone().lerp(hi, (p.getY(i) / 10 + 1) / 2); cols.push(c.r, c.g, c.b); }
    room.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (color, k, pos, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    panel("#ffffff", 5, [1, 7, 4], 7, 3.5);
    panel("#ffffff", 1.6, [5, 2, 6], 2.5, 4);
    panel(C.cyan, 2.2, [-7, 1, 2], 1.6, 6);
    panel(C.violet, 2.2, [7, -0.5, -3], 1.6, 6);
    panel("#ffffff", 0.6, [0, -6, 0], 8, 8);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 5); scene.add(key);
  const rimC = new THREE.PointLight(C.cyan, 16, 12); rimC.position.set(-3.5, 1.2, 1.5); scene.add(rimC);
  const rimV = new THREE.PointLight(C.violet, 20, 12); rimV.position.set(3.5, -0.8, -3); scene.add(rimV);

  const helmet = new THREE.Group();
  scene.add(helmet);

  // Point on a sphere of radius r: phi runs around the vertical axis (phi = PI/2 faces forward, +z),
  // theta from the top. Same convention (and UVs) as THREE.SphereGeometry.
  const P = (r, phi, theta) => new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
  const FWD = Math.PI / 2;
  const R = 1.2;
  const OPEN = { p0: FWD - 0.9, p1: FWD + 0.9, t0: 0.98, t1: 2.04, r: 0.32 };   // visor opening in (phi, theta), corner radius
  const GOLD_EDGE = 1.34;                                                         // lower edge of the raised gold visor
  const NECK = 2.42;                                                              // the shell stops here, above the neck ring

  /* Cut-outs are alpha masks painted in (phi, theta) space: on a full sphere's UVs,
     x = phi / 2PI, y = theta / PI, both at the same px per radian. */
  const MW = 1024, MH = 512, K = MW / (2 * Math.PI);
  function rrect(g, x0, y0, x1, y1, r) {
    g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath();
  }
  function mask(paint) {
    const c = document.createElement("canvas"); c.width = MW; c.height = MH;
    const g = c.getContext("2d"); paint(g);
    return new THREE.CanvasTexture(c);
  }
  const openingPath = (g) => rrect(g, OPEN.p0 * K, OPEN.t0 * K, OPEN.p1 * K, OPEN.t1 * K, OPEN.r * K);
  const shellMask = mask((g) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, MW, MH);
    g.fillStyle = "#000"; openingPath(g); g.fill();
    g.fillRect(0, NECK * K, MW, MH);
  });
  const goldMask = mask((g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, MW, MH);
    g.fillStyle = "#fff"; rrect(g, (OPEN.p0 - 0.06) * K, (OPEN.t0 - 0.12) * K, (OPEN.p1 + 0.06) * K, GOLD_EDGE * K, 0.1 * K); g.fill();
  });

  const SEG = [96, 64];
  const shellMat = new THREE.MeshPhysicalMaterial({ color: REAL.shell, roughness: 0.34, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, alphaMap: shellMask, alphaTest: 0.5, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshPhysicalMaterial({ color: REAL.trim, roughness: 0.45, metalness: 0.1, clearcoat: 0.3 });
  const metalMat = new THREE.MeshStandardMaterial({ color: REAL.metal, metalness: 1, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: REAL.dark, metalness: 0.4, roughness: 0.5 });
  const glowMat = (c, o = 0.95) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, transparent: o < 1, opacity: o, metalness: 0.2, roughness: 0.4 });

  /* Hard shell with the visor opening */
  helmet.add(new THREE.Mesh(new THREE.SphereGeometry(R, ...SEG), shellMat));
  // Rolled lip around the opening, and a dark seal just inside it
  const edge = (r) => {
    const pts = [], n = 28, { p0, p1, t0, t1 } = OPEN, rr = OPEN.r;
    const arc = (cp, ct, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push(P(r, cp + Math.cos(a) * rr, ct + Math.sin(a) * rr)); } };
    arc(p1 - rr, t0 + rr, -Math.PI / 2);      // top right (in phi/theta space)
    arc(p1 - rr, t1 - rr, 0);                 // bottom right
    arc(p0 + rr, t1 - rr, Math.PI / 2);       // bottom left
    arc(p0 + rr, t0 + rr, Math.PI);           // top left
    return new THREE.CatmullRomCurve3(pts, true, "centripetal");
  };
  helmet.add(new THREE.Mesh(new THREE.TubeGeometry(edge(R + 0.005), 320, 0.042, 12, true), trimMat));
  helmet.add(new THREE.Mesh(new THREE.TubeGeometry(edge(R - 0.035), 320, 0.022, 8, true), darkMat));

  /* Inside: dark cavity, then the mini display, then the clear pressure bubble, then the gold visor */
  helmet.add(new THREE.Mesh(new THREE.SphereGeometry(R - 0.12, 48, 32), new THREE.MeshStandardMaterial({ color: "#05070b", roughness: 1, side: THREE.BackSide })));

  const D = { p0: FWD - 0.78, p1: FWD - 0.32, t0: 1.42, t1: 1.92 };   // on the wearer's right, below the gold visor
  const tex = document.createElement("canvas"); tex.width = 256; tex.height = 300;
  const tctx = tex.getContext("2d");
  const texture = new THREE.CanvasTexture(tex);
  texture.colorSpace = THREE.SRGBColorSpace;
  const hudCol = { cyan: cssVar("--cyan", "#5ef2ff"), ok: cssVar("--ok", "#4dffb0"), warn: cssVar("--warn", "#ffc65c"), dim: cssVar("--text-dim", "#9aa6c8") };
  const mono = cssVar("--mono", "monospace");
  const trace = Array.from({ length: 40 }, () => 0.5);
  function drawDisplay() {
    const g = tctx, w = tex.width, h = tex.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(2, 14, 22, 0.55)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = hudCol.cyan; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = hudCol.cyan; g.font = `bold 22px ${mono}`; g.fillText("ASTRA // VITALS", 16, 36);
    const hr = Math.round(70 + Math.random() * 5);
    const rows = [["HEART", `${hr}`, hudCol.ok], ["SpO2", "97.6", hudCol.ok], ["RESP", "15", hudCol.ok], ["DOSE", "0.62", hudCol.warn]];
    rows.forEach(([k, val, c], i) => {
      const y = 80 + i * 40;
      g.fillStyle = hudCol.dim; g.font = `22px ${mono}`; g.fillText(k, 16, y);
      g.fillStyle = c; g.font = `bold 28px ${mono}`; g.textAlign = "right"; g.fillText(val, w - 16, y); g.textAlign = "left";
    });
    trace.shift(); trace.push(Math.random() < 0.12 ? 0.05 : 0.45 + Math.random() * 0.15);
    g.strokeStyle = hudCol.ok; g.lineWidth = 4; g.beginPath();
    trace.forEach((t, i) => { const x = 16 + i * (w - 32) / (trace.length - 1), y = 240 + t * 46; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    texture.needsUpdate = true;
  }
  drawDisplay();
  if (!reduced) setInterval(drawDisplay, 900);
  const display = new THREE.Mesh(
    new THREE.SphereGeometry(R - 0.075, 16, 12, D.p0, D.p1 - D.p0, D.t0, D.t1 - D.t0),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }),
  );
  display.renderOrder = 2;
  helmet.add(display);
  const anchors = {};
  anchors.display = new THREE.Object3D(); anchors.display.position.copy(P(R - 0.06, (D.p0 + D.p1) / 2, (D.t0 + D.t1) / 2)); helmet.add(anchors.display);

  const bubble = new THREE.Mesh(new THREE.SphereGeometry(R - 0.055, ...SEG),
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", metalness: 0, roughness: 0.03, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false }));
  bubble.renderOrder = 3;
  helmet.add(bubble);

  const gold = new THREE.Mesh(new THREE.SphereGeometry(R - 0.03, ...SEG),
    new THREE.MeshPhysicalMaterial({ color: REAL.gold, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3, alphaMap: goldMask, alphaTest: 0.5, side: THREE.DoubleSide }));
  helmet.add(gold);

  /* Helmet lights: a housing on each upper side with four lamps; a camera on the wearer's left */
  [-1, 1].forEach((side) => {
    const g = new THREE.Group();
    g.position.copy(P(R - 0.04, FWD + side * 1.2, 0.76));   // seated into the shell, not floating above it
    g.rotation.set(-0.18, side * 0.32, 0);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.44), trimMat); g.add(housing);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.02), darkMat); face.position.z = 0.225; g.add(face);
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), glowMat(new THREE.Color(REAL.lamp)));
      lamp.position.set(-0.09 + i * 0.06, 0, 0.237); g.add(lamp);
    }
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.2), trimMat); strut.position.set(-side * 0.1, -0.12, -0.05); g.add(strut);
    if (side === 1) {
      const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.2, 20), darkMat);
      cam.rotation.x = Math.PI / 2; cam.position.set(0.07, 0.13, 0.08); g.add(cam);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshPhysicalMaterial({ color: "#0b1830", metalness: 0.2, roughness: 0.05, clearcoat: 1 }));
      lens.position.set(0.07, 0.13, 0.181); g.add(lens);
    }
    helmet.add(g);
  });

  /* Visor pivot hubs at the sides (plain hardware: no buttons, gloves can't work small controls) */
  const EY = -0.02, EZ = -0.06, EX = 1.17, HR = 0.26, HW = 0.12;
  [-1, 1].forEach((side) => {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(HR, HR + 0.02, HW, 48), trimMat);
    hub.rotation.z = Math.PI / 2; hub.position.set(side * EX, EY, EZ); helmet.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(HR * 0.62, HR * 0.62, 0.03, 40), metalMat);
    cap.rotation.z = Math.PI / 2; cap.position.set(side * (EX + HW / 2 + 0.01), EY, EZ); helmet.add(cap);
    for (let i = 0; i < 4; i++) {   // screw heads
      const a = i * Math.PI / 2 + Math.PI / 4;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), darkMat);
      s.rotation.z = Math.PI / 2; s.position.set(side * (EX + HW / 2 + 0.005), EY + Math.sin(a) * HR * 0.8, EZ + Math.cos(a) * HR * 0.8); helmet.add(s);
    }
  });

  /* Hands-free inputs, all inside the bubble: microphones by the chin, inward IR eye cameras under the gold visor */
  const mic = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), glowMat(ctrl3d("voice")));
    m.position.copy(P(R - 0.1, FWD + i * 0.09, 1.98)); mic.add(m);
  }
  helmet.add(mic);
  anchors.voice = new THREE.Object3D(); anchors.voice.position.copy(P(R - 0.08, FWD, 1.98)); helmet.add(anchors.voice);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.03, 18), glowMat(ctrl3d("eyes")));
    eye.position.copy(P(R - 0.08, FWD + side * 0.16, 1.42)); eye.lookAt(0, eye.position.y, 0); eye.rotateY(Math.PI); helmet.add(eye);
  });
  anchors.eyes = new THREE.Object3D(); anchors.eyes.position.copy(P(R - 0.06, FWD + 0.16, 1.42)); helmet.add(anchors.eyes);

  /* Radiation dosimeter: a small module on top of the shell */
  const dose = new THREE.Group();
  const doseBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.18), trimMat); dose.add(doseBox);
  const doseLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.05), glowMat(ctrl3d("dose"))); doseLed.position.y = 0.034; dose.add(doseLed);
  const dp = P(R + 0.01, FWD, 0.42); dose.position.copy(dp);
  dose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dp.clone().normalize());
  helmet.add(dose);
  anchors.dose = new THREE.Object3D(); anchors.dose.position.copy(P(R + 0.06, FWD, 0.42)); helmet.add(anchors.dose);

  /* Neck ring: the shell seats in a metal bearing ring with locking lugs, over a dark collar */
  const neckY = R * Math.cos(NECK) - 0.03, neckR = R * Math.sin(NECK);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(neckR + 0.01, 0.045, 14, 72), trimMat);
  seat.rotation.x = Math.PI / 2; seat.position.y = neckY + 0.02; helmet.add(seat);
  const ringM = new THREE.Mesh(new THREE.CylinderGeometry(neckR + 0.06, neckR + 0.08, 0.16, 72, 1, true), metalMat);
  ringM.position.y = neckY - 0.09; helmet.add(ringM);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(neckR + 0.072, 0.012, 8, 72), darkMat);
  groove.rotation.x = Math.PI / 2; groove.position.y = neckY - 0.09; helmet.add(groove);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), metalMat);
    lug.position.set(Math.cos(a) * (neckR + 0.1), neckY - 0.09, Math.sin(a) * (neckR + 0.1)); lug.rotation.y = -a + Math.PI / 2; helmet.add(lug);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(neckR + 0.04, neckR + 0.14, 0.22, 72), darkMat);
  collar.position.y = neckY - 0.28; helmet.add(collar);

  const CENTER = new THREE.Vector3(0, 0.08, -0.7);
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
    const dotEl = document.createElementNS(NS, "circle");
    dotEl.setAttribute("r", "4"); dotEl.setAttribute("class", "g3d-dot");
    dotEl.style.fill = color; dotEl.style.filter = `drop-shadow(0 0 6px ${color})`; svg.appendChild(dotEl);
    return { el, line, dot: dotEl, anchor: anchors[el.dataset.target] };
  }).filter((c) => c.anchor);
  const v = new THREE.Vector3(), centre = new THREE.Vector3(), toCam = new THREE.Vector3();
  function drawCallouts(w, h) {
    const box = stage.getBoundingClientRect();
    helmet.getWorldPosition(centre);
    callouts.forEach((c) => {
      c.anchor.getWorldPosition(v);
      // Fade the arrow when its part is on the far side of the helmet
      const facing = v.clone().sub(centre).normalize().dot(toCam.copy(camera.position).sub(v).normalize());
      const o = facing > -0.05 ? 0.9 : 0.22;
      c.line.style.opacity = o; c.dot.style.opacity = o;
      v.project(camera);
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
    const d = 7.4 * Math.max(1, 1.2 / camera.aspect) / (parseFloat(stage.dataset.zoom) || 1);
    camera.position.set(0, 1.5 * d / 7.4, d - 0.7);
    camera.lookAt(CENTER.x, CENTER.y - 0.15, CENTER.z);
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
    helmet.rotation.set(0.08 + pitch, yaw + sway, 0);
    renderer.render(scene, camera);
    drawCallouts(w, h);
  }
  requestAnimationFrame(frame);
})();
