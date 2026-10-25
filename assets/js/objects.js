// A wireframe object per page, drawn with three.js, that turns to face the cursor.
// Which object: section.model, else a default per section id (see DEFAULTS), else a cube.
import * as THREE from "three";
import { TeapotGeometry } from "three/addons/geometries/TeapotGeometry.js";

const ACCENT = 0xff7a1a;
const DEFAULTS = {
  universities: "university", industry: "gear", workshops: "easel", portfolio: "teapot",
  classes: "bulb", projects: "rocket", contact: "plane",
};

const mat = {
  main: new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 }),
  soft: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
  glow: new THREE.LineBasicMaterial({ color: 0xff6b5e, transparent: true, opacity: 1 }),
};
const edges = (g, m = mat.main, angle = 20) => new THREE.LineSegments(new THREE.EdgesGeometry(g, angle), m);
const wire = (g, m = mat.soft) => new THREE.LineSegments(new THREE.WireframeGeometry(g), m);
const at = (obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
};
const line = (pts, m = mat.main) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), m);

const MODELS = {
  // Neoclassical campus building: steps, colonnade, pediment, drum and dome
  university() {
    const g = new THREE.Group();
    g.add(at(edges(new THREE.BoxGeometry(3.3, 0.14, 1.9)), 0, 0.07, 0));
    g.add(at(edges(new THREE.BoxGeometry(3.05, 0.14, 1.7)), 0, 0.21, 0));
    g.add(at(edges(new THREE.BoxGeometry(2.7, 1.15, 1.1), mat.soft), 0, 0.855, -0.2));
    for (let i = 0; i < 6; i++) {
      g.add(at(edges(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6), mat.main, 30), -1.15 + i * 0.46, 0.83, 0.6));
    }
    // windows on the facade behind the colonnade
    for (let i = 0; i < 5; i++) g.add(at(edges(new THREE.PlaneGeometry(0.22, 0.5), mat.soft), -0.92 + i * 0.46, 0.85, 0.36));
    g.add(at(edges(new THREE.BoxGeometry(2.95, 0.14, 1.55)), 0, 1.45, -0.02));
    const tri = new THREE.Shape([new THREE.Vector2(-1.475, 0), new THREE.Vector2(1.475, 0), new THREE.Vector2(0, 0.5)]);
    g.add(at(edges(new THREE.ExtrudeGeometry(tri, { depth: 1.55, bevelEnabled: false })), 0, 1.52, -0.8));
    g.add(at(edges(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 12), mat.main, 20), 0, 1.85, -0.35));
    g.add(at(wire(new THREE.SphereGeometry(0.5, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), 0, 2.03, -0.35));
    g.add(at(edges(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 6), mat.main, 30), 0, 2.66, -0.35));
    return g;
  },

  // Two meshing gears — the machinery of production
  gear() {
    const g = new THREE.Group();
    const make = (teeth, r, depth) => {
      const s = new THREE.Shape();
      const step = (Math.PI * 2) / teeth, root = r * 0.8;
      for (let i = 0; i < teeth; i++) {
        const a = i * step;
        [[root, a], [r, a + step * 0.2], [r, a + step * 0.5], [root, a + step * 0.7]].forEach(([rad, ang], k) => {
          const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
          i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
        });
      }
      s.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
      s.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 });
      geo.translate(0, 0, -depth / 2);
      return edges(geo, mat.main, 30);
    };
    const big = at(make(12, 1.1, 0.34), -0.55, -0.2, 0);
    const small = at(make(8, 0.74, 0.34), 1.02, 0.62, 0);
    small.rotation.z = Math.PI / 8;
    g.add(big, small);
    g.userData.update = (t) => {
      big.rotation.z = t * 0.5;
      small.rotation.z = Math.PI / 8 - t * 0.5 * (12 / 8);
    };
    return g;
  },

  // Easel with a sketch on the canvas
  easel() {
    const g = new THREE.Group();
    const leg = () => new THREE.BoxGeometry(0.07, 3.2, 0.07);
    g.add(at(edges(leg()), -0.62, 0, 0.1, -0.1, 0, -0.17));
    g.add(at(edges(leg()), 0.62, 0, 0.1, -0.1, 0, 0.17));
    g.add(at(edges(leg(), mat.soft), 0, -0.05, -0.55, 0.38, 0, 0));
    g.add(at(edges(new THREE.BoxGeometry(1.5, 0.07, 0.25)), 0, -0.45, 0.2, -0.1, 0, 0));
    const canvas = new THREE.Group();
    canvas.add(edges(new THREE.BoxGeometry(1.7, 1.25, 0.05)));
    const f = 0.03;
    canvas.add(line([[-0.7, -0.45, f], [-0.3, 0.05, f], [-0.05, -0.2, f], [0.3, 0.3, f], [0.7, -0.45, f]], mat.glow));
    const sun = new THREE.EllipseCurve(0, 0, 0.14, 0.14).getPoints(24).map((p) => [p.x + 0.45, p.y + 0.35, f]);
    canvas.add(line(sun, mat.glow));
    g.add(at(canvas, 0, 0.25, 0.25, -0.1, 0, 0));
    return g;
  },

  // The Utah teapot — computer graphics' oldest test model
  teapot() {
    const g = new THREE.Group();
    g.add(wire(new TeapotGeometry(0.95, 5), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 })));
    return g;
  },

  // Lightbulb with a glowing filament
  bulb() {
    const g = new THREE.Group();
    const profile = [[0.001, 1.6], [0.3, 1.56], [0.62, 1.4], [0.86, 1.08], [0.95, 0.7], [0.88, 0.3], [0.62, -0.1], [0.42, -0.45], [0.36, -0.75], [0.001, -0.75]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    g.add(wire(new THREE.LatheGeometry(profile, 14), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.5 })));
    for (let i = 0; i < 4; i++) {
      g.add(at(edges(new THREE.TorusGeometry(0.37, 0.035, 4, 20), mat.soft, 60), 0, -0.85 - i * 0.14, 0, Math.PI / 2));
    }
    g.add(at(edges(new THREE.CylinderGeometry(0.2, 0.3, 0.2, 12), mat.soft, 60), 0, -1.48, 0));
    const fil = line([[-0.25, -0.4, 0], [-0.25, 0.35, 0], [-0.15, 0.55, 0], [-0.05, 0.35, 0], [0.05, 0.55, 0], [0.15, 0.35, 0], [0.25, 0.55, 0], [0.25, -0.4, 0]], mat.glow);
    g.add(fil);
    g.userData.update = (t) => { mat.glow.opacity = 0.55 + Math.sin(t * 3) * 0.45; };
    return g;
  },

  // Rocket with a flickering exhaust
  rocket() {
    const g = new THREE.Group();
    const body = [[0.001, 2.0], [0.2, 1.7], [0.4, 1.2], [0.5, 0.6], [0.5, -0.8], [0.42, -1.1], [0.001, -1.1]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(wire(new THREE.LatheGeometry(body, 12), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 })));
    g.add(at(edges(new THREE.TorusGeometry(0.18, 0.04, 4, 20), mat.glow, 60), 0, 0.75, 0.47));
    const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.55, -0.35), new THREE.Vector2(0.55, -0.85), new THREE.Vector2(0, -0.5)]);
    for (let i = 0; i < 3; i++) {
      const f = edges(new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: false }));
      const holder = new THREE.Group();
      f.position.set(0.45, -0.35, -0.025);
      holder.add(f);
      holder.rotation.y = (i * Math.PI * 2) / 3;
      g.add(holder);
    }
    const flame = at(wire(new THREE.ConeGeometry(0.3, 0.9, 8, 2, true), mat.glow), 0, -1.55, 0, Math.PI);
    g.add(flame);
    g.userData.update = (t) => {
      flame.scale.set(1, 0.8 + Math.abs(Math.sin(t * 12)) * 0.4, 1);
      g.position.y = Math.sin(t * 1.6) * 0.08;
    };
    return g;
  },

  // Paper plane on a looping flight path
  plane() {
    const g = new THREE.Group();
    // Wings rise in a V from the centre fold; the keel hangs below it
    const nose = [0, 0, 1.5], tl = [-1.0, 0.42, -1.0], tr = [1.0, 0.42, -1.0], c = [0, -0.02, -1.0], keel = [0, -0.55, -1.0];
    const segs = [[nose, tl], [nose, tr], [nose, c], [nose, keel], [tl, c], [c, tr], [c, keel]];
    const plane = new THREE.Group();
    segs.forEach((s) => plane.add(line(s)));
    const faces = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(
      [nose, tl, c, nose, c, tr, nose, c, keel].flat(), 3));
    plane.add(new THREE.Mesh(faces, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })));
    g.add(plane);
    const trail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.1, -1.2), new THREE.Vector3(-0.7, -0.4, -1.9), new THREE.Vector3(0.2, -0.8, -2.4), new THREE.Vector3(0.9, -0.5, -2.0),
    ]);
    const dash = new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, dashSize: 0.12, gapSize: 0.1 });
    const tLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(trail.getPoints(60)), dash);
    tLine.computeLineDistances();
    g.add(tLine);
    g.userData.fit = plane; // size the plane itself; the trail can spill over
    g.rotation.set(0.25, -0.95, 0); // three-quarter view: nose left, seen slightly from above
    g.userData.update = (t) => {
      plane.rotation.z = Math.sin(t * 1.3) * 0.25;
      plane.position.y = Math.sin(t * 1.3 + 1) * 0.1;
    };
    return g;
  },

  cube() {
    const g = new THREE.Group();
    g.add(edges(new THREE.BoxGeometry(1.8, 1.8, 1.8)));
    g.add(wire(new THREE.BoxGeometry(1.8, 1.8, 1.8, 3, 3, 3)));
    return g;
  },
};

/* v4.1 (memory): every renderer is disposed and its GL context released when the
   page is left (Safari otherwise keeps contexts alive across reloads and kills
   the tab once its limits are hit), and a lost context just stops drawing. */
function guard(renderer, stop) {
  const el = renderer.domElement;
  el.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); }, false);
  addEventListener("pagehide", () => {
    stop();
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {}
    el.width = el.height = 0;
    el.remove();
  }, { once: true });
  addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });
}
const lowMem = !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
const makeRenderer = (opts) => {
  try { return new THREE.WebGLRenderer(opts); } catch (_) { return null; }   // no WebGL: skip the object
};

/* v4.3: Contact-page fallback when WebGL is unavailable (e.g. Chrome with hardware
   acceleration off): a flat wireframe paper plane (SVG) flies the same figure-8. */
function svgFly(wrap) {
  wrap.classList.add("obj-fly-2d");
  wrap.innerHTML = `<svg viewBox="-60 -40 120 80" width="100%" height="100%" fill="none" stroke="#ff7a1a" stroke-width="1.6" stroke-linejoin="round">
    <path d="M-50 0 L50 -28 L18 30 Z" fill="#ff7a1a22"/><path d="M-50 0 L50 -28 L4 6 Z"/><path d="M4 6 L18 30"/><path d="M4 6 L-6 20 L18 30" fill="#ff7a1a14"/></svg>`;
  const svg = wrap.firstElementChild;
  let dead = false, op = "", avoid = [], at = 0, ang = 0;
  addEventListener("pagehide", () => { dead = true; }, { once: true });
  const pos = (t) => {
    const W = innerWidth, H = innerHeight, S = wrap.offsetWidth || 160, a = (2 * Math.PI) / 28;
    return [W / 2 + (W / 2 - S * 0.6) * Math.sin(a * t), H * 0.3 + H * 0.17 * Math.sin(2 * a * t) + Math.sin(t * 1.7) * 6, S];
  };
  const t0 = performance.now();
  const tick = (now) => {
    if (dead) return;
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = (now - t0) / 1000;
    const [x, y, S] = pos(t), [x2, y2] = pos(t + 0.15);
    const dx = x2 - x, dy = y2 - y, right = dx >= 0;
    const want = Math.atan2(dy, Math.abs(dx)) * (right ? 1 : -1);
    ang += (want - ang) * 0.08;
    wrap.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px, ${(y - S / 2).toFixed(1)}px, 0)`;
    // the SVG nose points left: mirror it when flying right, tilt with the climb/dive
    svg.style.transform = `scaleX(${right ? -1 : 1}) rotate(${(-ang * 57.3 * (right ? -1 : 1)).toFixed(1)}deg)`;
    if (t - at > 0.5) { at = t; avoid = [...document.querySelectorAll("#page h1, #page h2, #page p, #page form, .contact-lines")].map((e) => e.getBoundingClientRect()); }
    const over = avoid.some((r) => x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 30);
    const o = over ? "0.28" : "0.92";
    if (o !== op) { wrap.style.opacity = o; op = o; }
  };
  requestAnimationFrame(tick);
}

function start(id, override) {
  const name = MODELS[override] ? override : DEFAULTS[id] || "cube";
  const wrap = document.createElement("div");
  wrap.className = "obj-wrap";
  wrap.setAttribute("aria-hidden", "true");
  // v4.1: on the Contact page the paper plane flies a slow loop over the whole page
  // (same renderer, the wrapper just moves; never blocks clicks)
  const fly = name === "plane" && id === "contact";   // v4.3: flies regardless of OS reduced motion
  if (fly) wrap.classList.add("obj-fly");
  document.body.append(wrap);

  const size = wrap.clientWidth || 220;
  const renderer = makeRenderer({ alpha: true, antialias: !lowMem });
  if (!renderer) { if (fly) svgFly(wrap); else wrap.remove(); return; }   // v4.3: no WebGL → 2D plane still flies
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(size, size);
  wrap.append(renderer.domElement);
  let dead = false;
  guard(renderer, () => { dead = true; });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.6, 7.2);
  camera.lookAt(0, 0, 0);

  // Centre and normalise the model so every object reads at the same size
  const model = MODELS[name]();
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.userData.fit || model);
  const dim = box.getSize(new THREE.Vector3());
  const scale = 2.9 / Math.max(dim.x, dim.y, dim.z);
  model.scale.setScalar(scale);
  model.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-scale));
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  // v4.3: objects turn regardless of OS reduced motion; Asset Bay keeps its original behaviour
  const reduce = id === "shop" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0.5, y: 0.5 };
  addEventListener("pointermove", (e) => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);

  let rx = 0.15, ry = -0.5, spin = 0;
  const clock = new THREE.Clock();
  // flight path: a figure-8 across the upper part of the viewport, nose along the travel direction
  const F = { x: 0, y: 0, vx: 0, vy: 0, yaw: 0.95, pitch: 0, bank: 0, op: "", avoid: [], at: 0 };
  const flyPos = (t) => {
    const W = innerWidth, H = innerHeight, S = wrap.offsetWidth || 160, a = (2 * Math.PI) / 28;
    return [W / 2 + (W / 2 - S * 0.6) * Math.sin(a * t), H * 0.3 + H * 0.17 * Math.sin(2 * a * t) + Math.sin(t * 1.7) * 6, S];
  };
  const flyStep = (t, dt) => {
    const [x, y, S] = flyPos(t), [x2, y2] = flyPos(t + 0.15);
    const vx = (x2 - x) / 0.15, vy = (y2 - y) / 0.15;
    const k = 1 - Math.exp(-dt * 4);
    F.yaw += (0.95 + 0.95 * Math.tanh(vx / 90) - F.yaw) * k;          // nose left <-> nose right
    F.pitch += (Math.tanh(-vy / 160) * 0.45 - F.pitch) * k;
    F.bank += (Math.tanh((vx - F.vx) / dt / 260 || 0) * 0.5 - F.bank) * k;
    F.vx = vx; F.vy = vy;
    wrap.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px, ${(y - S / 2).toFixed(1)}px, 0)`;
    // fade while crossing text / the form so it never sits on top of reading for long
    if (t - F.at > 0.5) { F.at = t; F.avoid = [...document.querySelectorAll("#page h1, #page h2, #page p, #page form, .contact-lines")].map((e) => e.getBoundingClientRect()); }
    const over = F.avoid.some((r) => x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 30);
    const op = over ? "0.28" : "0.92";
    if (op !== F.op) { wrap.style.opacity = op; F.op = op; }
    pivot.rotation.set(0.35 + F.pitch, F.yaw - 0.95, F.bank);
  };
  let lastT = 0;
  const tick = () => {
    if (dead) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    if (fly) {
      flyStep(t, Math.min(0.05, t - lastT || 0.016)); lastT = t;
      model.userData.update?.(t);
    } else if (!reduce) {
      spin += 0.003;
      rx += ((pointer.y - 0.5) * 0.7 + 0.12 - rx) * 0.05;
      ry += ((pointer.x - 0.5) * 1.4 - 0.5 + spin - ry) * 0.05;
      pivot.rotation.set(rx, ry, 0);
      model.userData.update?.(t);
    }
    renderer.render(scene, camera);
  };
  tick();
}

// site.js sets data-model once content has loaded
const go = () => start(document.body.dataset.section, document.body.dataset.model);
if (document.body.dataset.section) go();
else document.addEventListener("hv:page", go, { once: true });

/* v4: the landing "workspace". As the visitor scrolls, the camera pulls back from
   the portrait to a Blender-like scene: a floor grid with the X/Y axes and the
   site's wireframe objects floating around the viewport. Loaded on demand (first
   scroll, after the opening), rendered only while the pullback is on screen. */
function fitted(name, size) {
  const model = MODELS[name]();
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.userData.fit || model);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.x, dim.y, dim.z);
  model.scale.setScalar(s);
  model.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-s));
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.userData.model = model;
  return pivot;
}
export function workspace(host) {
  const renderer = lowMem ? null : makeRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  if (!renderer) return { set() {}, active() {} };   // low-memory device or no WebGL: panels only
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  host.append(renderer.domElement);
  let dead = false;
  guard(renderer, () => { dead = true; });
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c0d10, 14, 42);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  const grid = new THREE.GridHelper(80, 80, 0x4a4a4f, 0x26272c);
  grid.position.y = -2.4;
  scene.add(grid);
  const axisX = line([[-40, -2.39, 0], [40, -2.39, 0]], new THREE.LineBasicMaterial({ color: 0xff3352, transparent: true, opacity: 0.7 }));
  const axisY = line([[0, -2.39, -40], [0, -2.39, 40]], new THREE.LineBasicMaterial({ color: 0x8bdc00, transparent: true, opacity: 0.7 }));
  scene.add(axisX, axisY);

  const spots = [
    ["teapot", -7.2, 1.6, -2, 1.9], ["bulb", 7.4, 2.2, -2.5, 1.7], ["gear", -6.4, -1.3, 1, 1.6],
    ["university", 6.6, -1.2, 0.8, 2.0], ["rocket", -3.6, 3.6, -5, 1.6], ["plane", 3.8, 3.8, -5.5, 1.7],
    ["easel", 0.2, -1.6, -7, 1.8],
  ];
  const objs = spots.map(([name, x, y, z, size], i) => {
    const o = fitted(name, size);
    o.position.set(x, y, z);
    o.userData.base = [x, y, z];
    o.userData.phase = i * 1.3;
    scene.add(o);
    return o;
  });

  let p = 0, on = false, w = 0, h = 0;
  const size = () => {
    w = host.clientWidth; h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  size();
  addEventListener("resize", size);
  const clock = new THREE.Clock();
  let looping = false;
  const tick = () => {
    if (dead || !on) { looping = false; return; }   // one loop at most, and only while on screen
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    const e = 1 - Math.pow(1 - p, 3);
    camera.position.set(Math.sin(t * 0.1) * 0.6 * e, 0.4 + 2.4 * e, 3.2 + 10 * e);
    camera.lookAt(0, 0.4, 0);
    objs.forEach((o) => {
      const [x, y, z] = o.userData.base;
      o.position.set(x, y + Math.sin(t * 0.8 + o.userData.phase) * 0.18, z);
      o.rotation.y = t * 0.25 + o.userData.phase;
      o.userData.model.userData.update?.(t);
    });
    renderer.render(scene, camera);
  };
  return {
    set(v) { p = v; },
    active(v) {
      on = v && !dead;
      host.classList.toggle("on", on);
      if (on && !looping) { looping = true; requestAnimationFrame(tick); }
    },
  };
}
