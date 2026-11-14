/* ==========================================================
   AstraSight — 3D glasses on the home page (three.js r160, UMD build)
   Procedural model, no asset files. Callout arrows follow the
   left button, right button and scroll knob as the model turns.
   "Left" and "right" are the wearer's: the wearer looks along +z,
   so their right temple sits at -x.
   ========================================================== */
(function () {
  const stage = document.getElementById("glasses-stage");
  if (!stage) return;
  const canvas = stage.querySelector("canvas");
  const svg = stage.querySelector("svg.g3d-lines");
  if (!window.THREE || !canvas) { stage.classList.add("g3d-fallback"); return; }

  const css = getComputedStyle(document.documentElement);
  const tok = (n, d) => new THREE.Color((css.getPropertyValue(n) || d).trim());
  const C = {
    frame: tok("--surface-solid", "#0e1428"), cyan: tok("--cyan", "#5ef2ff"),
    violet: tok("--violet", "#8f7cff"), magenta: tok("--magenta", "#ff6ad5"),
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
  camera.position.set(0, 2.1, 6.4);
  camera.lookAt(0, 0, -0.7);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 4); scene.add(key);
  const rimC = new THREE.PointLight(C.cyan, 18, 12); rimC.position.set(-3, 1.5, 2); scene.add(rimC);
  const rimV = new THREE.PointLight(C.violet, 22, 12); rimV.position.set(3, -1, -3); scene.add(rimV);

  const frameMat = new THREE.MeshStandardMaterial({ color: C.frame.clone().multiplyScalar(1.6), metalness: 0.7, roughness: 0.32 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: C.cyan, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const glowMat = (c, o = 0.9) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, transparent: o < 1, opacity: o, metalness: 0.2, roughness: 0.4 });

  const glasses = new THREE.Group();
  scene.add(glasses);

  /* Lens rims: rounded rectangle with a hole, extruded */
  function rounded(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const W = 1.3, H = 0.86, T = 0.09;
  const rimShape = rounded(W, H, 0.32);
  rimShape.holes.push(rounded(W - 2 * T, H - 2 * T, 0.25));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 24 });
  const lensGeo = new THREE.ShapeGeometry(rounded(W - 2 * T, H - 2 * T, 0.25), 24);
  [-1, 1].forEach((side) => {
    const rim = new THREE.Mesh(rimGeo, frameMat);
    rim.position.set(side * 0.74, 0, -0.05); glasses.add(rim);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(side * 0.74, 0, 0); glasses.add(lens);
  });
  // In-lens HUD side panel, on the wearer's right lens (-x)
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.46), glowMat(C.cyan, 0.45));
  hud.position.set(-1.0, 0.02, 0.01); glasses.add(hud);
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16 - (i % 2) * 0.05, 0.025), glowMat(C.cyan, 0.9));
    bar.position.set(-1.02, 0.15 - i * 0.09, 0.015); glasses.add(bar);
  }

  // Bridge
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 12, 24, Math.PI), frameMat);
  bridge.position.set(0, 0.1, 0.0); glasses.add(bridge);

  /* Temples (arms) */
  const TY = 0.22, TX = 1.43, TL = 2.7;
  const anchors = {};
  [-1, 1].forEach((side) => {
    const x = side * TX;
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.22), frameMat);
    hinge.position.set(side * 1.37, TY, -0.06); glasses.add(hinge);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.17, TL), frameMat);
    arm.position.set(x, TY, -0.1 - TL / 2); glasses.add(arm);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.7), frameMat);
    tip.position.set(x, TY - 0.2, -0.1 - TL - 0.25); tip.rotation.x = -0.65; glasses.add(tip);
    // Accent stripe along the outer face
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.02, TL * 0.6), glowMat(C.frame.clone().lerp(new THREE.Color("#ffffff"), 0.35), 0.5));   // neutral, so control colors stand out
    stripe.position.set(x + side * 0.052, TY - 0.03, -0.25 - TL * 0.3); glasses.add(stripe);

    // Button on top of each temple, near the hinge
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.24, 6, 12), glowMat(ctrl3d(side === 1 ? "left" : "right")));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(x, TY + 0.1, -0.6); glasses.add(btn);
    const a = new THREE.Object3D(); a.position.set(x, TY + 0.14, -0.6); glasses.add(a);
    anchors[side === 1 ? "left" : "right"] = a;
  });

  // Scroll knob: a small ribbed crown on the OUTER face of the right temple (-x), joined to it by a short axle
  const KR = 0.095, KW = 0.06, AX = 0.035;            // knob radius, knob width, axle length
  const armOuter = -(TX + 0.05);                       // outer face of the right arm
  const knobX = armOuter - AX - KW / 2;
  const knob = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: C.frame.clone().multiplyScalar(3), metalness: 0.85, roughness: 0.25, flatShading: true });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(KR, KR, KW, 24), metal);
  wheel.rotation.z = Math.PI / 2; knob.add(wheel);
  for (let i = 0; i < 12; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(KW + 0.006, 0.016, 0.02), frameMat);
    const t = (i / 12) * Math.PI * 2;
    rib.position.set(0, Math.cos(t) * (KR + 0.004), Math.sin(t) * (KR + 0.004)); rib.rotation.x = -t; knob.add(rib);
  }
  const knobGlow = glowMat(ctrl3d("knob"));
  [-1, 1].forEach((s) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(KR, 0.009, 8, 28), knobGlow);
    ring.rotation.y = Math.PI / 2; ring.position.x = s * (KW / 2 - 0.004); knob.add(ring);
  });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(KR * 0.45, 20), knobGlow);   // lit centre on the outer face
  cap.rotation.y = -Math.PI / 2; cap.position.x = -KW / 2 - 0.002; knob.add(cap);
  const KZ = -1.0;
  knob.position.set(knobX, TY, KZ); glasses.add(knob);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, AX + 0.01, 16), frameMat);
  axle.rotation.z = Math.PI / 2; axle.position.set(armOuter - AX / 2 + 0.005, TY, KZ); glasses.add(axle);
  anchors.knob = new THREE.Object3D(); anchors.knob.position.set(knobX - KW / 2, TY, KZ); glasses.add(anchors.knob);

  // Rotate around the middle of the frame, not the lenses, so the temples stay in view
  glasses.children.forEach((c) => { c.position.z += 1.3; });
  glasses.position.z = -0.7;

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
  });
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
    // Pull back on narrow screens so both temples stay in frame
    const d = 6.4 * Math.max(1, 1.3 / camera.aspect);
    camera.position.set(0, 2.1 * d / 6.4, d);
    camera.lookAt(0, 0, -0.7);
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
    glasses.rotation.set(0.12 + pitch, yaw + sway, 0);
    if (!reduced) knob.rotation.x = now / 900;   // knob turns slowly, hinting it scrolls
    renderer.render(scene, camera);
    drawCallouts(w, h);
  }
  requestAnimationFrame(frame);
})();
