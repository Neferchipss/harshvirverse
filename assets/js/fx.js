/* v4 "wow" layer — everything here is progressive enhancement on top of site.js.
   - Opening: after the Cycles tile loader, the viewport shows the head in
     wireframe, then "renders" progressively (coarse noisy samples → clean) while
     the head turns to face the visitor.
   - Cursor light: the portrait is a sequence of real photos, not a 3D model, so
     the light is faked in 2D: a low-res radial falloff (warm core → shadow,
     plain alpha, scaled up by CSS) plus a warm rim glow taken from a precomputed
     edge sprite of the photo frames (assets/hero/rim-edges.webp), drawn only in
     a small window around the cursor. EEVEE in the easter egg adds a soft-light
     key bloom.
   - Scroll pullback, 3D name, wireframe→final portfolio reveals, count-ups,
     magnetic buttons, viewport-wipe page transitions, optional hover sounds,
     Asset Bay turntable and a render-settings easter egg (press R).
   Heavy work waits for the first paint / end of the loader, pauses when the tab
   is hidden or the effect is off screen, and prefers-reduced-motion gets a calm
   version (no opening, static light, no pullback, no wipes). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const HOME = document.body.classList.contains("home");
  const P = { x: innerWidth * 0.6, y: innerHeight * 0.4, moved: false };
  addEventListener("pointermove", (e) => { P.x = e.clientX; P.y = e.clientY; P.moved = true; }, { passive: true });
  const settings = { light: 1, tint: "warm", samples: 128, shade: "rendered", engine: "cycles" };
  document.documentElement.classList.add("v4");

  /* v4.1 (memory): one teardown when the page is left. Every loop stops, the
     sprite bitmap and audio are released and every canvas is shrunk to 0×0, so
     Safari doesn't carry canvas memory into the next load. */
  let gone = false;
  const pool = new Set();
  const own = (cv) => (pool.add(cv), cv);
  let releaseSprite = () => {};
  addEventListener("pagehide", () => {
    gone = true;
    releaseSprite();
    try { audio && audio.close && audio.close(); } catch (_) {}
    audio = null;
    pool.forEach((cv) => { cv.width = cv.height = 0; });
    document.querySelectorAll("canvas").forEach((cv) => { if (!cv.closest(".obj-wrap, .ws-3d")) { cv.width = cv.height = 0; } });
  });
  addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

  /* ---------- edge map: "wireframe" line art from any image ---------- */
  const work = own(mk("canvas"));
  const wctx = work.getContext("2d", { willReadFrequently: true });
  function edgeMap(src, sx, sy, sw, sh, w, h, out, opt = {}) {
    work.width = w; work.height = h;
    wctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    const d = wctx.getImageData(0, 0, w, h).data;
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
    out = out || own(mk("canvas"));
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const oc = out.getContext("2d");
    const img = oc.createImageData(w, h), o = img.data;
    const [r, g, b] = opt.rgb || [255, 170, 100];
    const thr = opt.thr ?? 26, k = opt.k ?? 4;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
        const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
        const m = Math.abs(gx) + Math.abs(gy);
        if (m > thr) { const j = i * 4; o[j] = r; o[j + 1] = g; o[j + 2] = b; o[j + 3] = Math.min(255, (m - thr) * k); }
      }
    }
    oc.putImageData(img, 0, 0);
    return out;
  }
  // a Blender-style wireframe viewport: dark backdrop, grid, line art on top
  function wireBackdrop(ctx, w, h, cell) {
    ctx.fillStyle = "#1f2024";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < w; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0.5; y < h; y += cell) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  /* ---------- Hover sounds (off by default) ---------- */
  let audio = null, soundOn = false;
  try { soundOn = localStorage.getItem("hv-sound") === "1"; } catch (_) {}
  const blip = (f = 1320, len = 0.05, vol = 0.035) => {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + len);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + len + 0.02);
    } catch (_) {}
  };
  const setSound = (v) => {
    soundOn = v;
    try { localStorage.setItem("hv-sound", v ? "1" : "0"); } catch (_) {}
    $$(".snd, [data-set=sound]").forEach((b) => { b.setAttribute("aria-pressed", String(v)); if (b.classList.contains("snd")) b.title = `Hover sounds: ${v ? "on" : "off"}`; else b.textContent = v ? "On" : "Off"; });
    if (v) blip(990, 0.08, 0.05);
  };
  function soundToggle() {
    const bar = $("#topbar");
    if (!bar || $(".snd", bar)) return;
    const b = mk("button", "snd");
    b.type = "button";
    b.setAttribute("aria-pressed", String(soundOn));
    b.setAttribute("aria-label", "Hover sounds");
    b.title = `Hover sounds: ${soundOn ? "on" : "off"}`;
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="m16 9 6 6m0-6-6 6"/></svg>';
    b.addEventListener("click", () => setSound(!soundOn));
    bar.insertBefore(b, $(".nav-cta", bar));
    let lastT = 0;
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, .turntable");
      if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
      const now = performance.now();
      if (now - lastT < 70) return;
      lastT = now;
      blip(t.matches(".btn.primary, .btn-buy, .nav-cta") ? 880 : 1320);
    });
  }

  /* ---------- Magnetic buttons ---------- */
  function magnets() {
    if (!FINE || RM) return;
    $$(".btn, .nav-cta, .btn-buy, .big-cta, .snd").forEach((n) => {
      if (n.dataset.mag) return;
      n.dataset.mag = "1";
      n.classList.add("magnet");
      n.addEventListener("pointermove", (e) => {
        const r = n.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        n.style.transform = `translate3d(${dx * 0.28}px, ${dy * 0.38}px, 0)`;
      });
      n.addEventListener("pointerleave", () => { n.style.transform = ""; });
    });
  }

  /* ---------- Viewport-switch page wipes ---------- */
  window.hvWipe = RM ? null : (a) => {
    const label = (a.textContent || "").replace(/[→↗]/g, "").trim().slice(0, 40) || "Home";
    try { sessionStorage.setItem("hv-wipe", label); } catch (_) {}
    const w = mk("div", "wipe in");
    w.setAttribute("aria-hidden", "true");
    w.append(mk("span", "wipe-l", `Switching viewport → ${label}`));
    document.body.append(w);
    blip(660, 0.09, 0.04);
    return 420;
  };
  (() => {
    let label = null;
    try { label = sessionStorage.getItem("hv-wipe"); sessionStorage.removeItem("hv-wipe"); } catch (_) {}
    if (!label || RM || $("#boot")) return;
    const w = mk("div", "wipe hold");
    w.setAttribute("aria-hidden", "true");
    w.append(mk("span", "wipe-l", label));
    document.body.append(w);
    const go = () => { w.classList.add("out"); setTimeout(() => w.remove(), 700); };
    document.addEventListener("hv:ready", () => requestAnimationFrame(() => requestAnimationFrame(go)), { once: true });
    setTimeout(go, 1600);   // never block the page
  })();
  addEventListener("pageshow", (e) => { if (e.persisted) $$(".wipe").forEach((w) => w.remove()); });

  /* ---------- Count-ups ---------- */
  function countUp(nodes) {
    nodes.forEach((b) => {
      const t = b.firstChild;
      if (!t || t.nodeType !== 3) return;
      const end = parseInt(t.nodeValue, 10);
      if (!end || end > 999 || RM) return;
      t.nodeValue = "0";
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 900 + end * 40;
        const step = (now) => {
          const k = ease((now - t0) / dur);
          t.nodeValue = String(Math.round(end * k));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      io.observe(b);
    });
  }

  /* ---------- Wireframe → final reveals (portfolio cards and tiles) ---------- */
  function wireReveals() {
    if (RM) return;
    const medias = $$(".work-media, .tile-media").filter((m) => $("img", m) && !m.dataset.wf);
    if (!medias.length) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.dataset.wfIn = "1";
      e.target._wfGo && e.target._wfGo();
    }), { threshold: 0.45 });
    medias.forEach((m) => {
      m.dataset.wf = "1";
      const img = $("img:not(.off)", m) || $("img", m);
      const cv = mk("canvas", "wf-cv");
      cv.setAttribute("aria-hidden", "true");
      const scan = mk("i", "wf-scan");
      m.classList.add("wf");
      m.append(cv, scan);
      let ready = false;
      const draw = () => {
        const r = m.getBoundingClientRect();
        const w = Math.max(160, Math.min(720, Math.round(r.width))), h = Math.max(90, Math.round(w * (r.height / (r.width || 1))));
        cv.width = w; cv.height = h;
        const c = cv.getContext("2d");
        wireBackdrop(c, w, h, 24);
        if (img.naturalWidth) {
          try {
            const ir = img.naturalWidth / img.naturalHeight, br = w / h;
            let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
            if (ir > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (img.naturalHeight - sh) / 2; }
            c.drawImage(edgeMap(img, sx, sy, sw, sh, w, h, null, { rgb: [226, 228, 236], thr: 90, k: 1.6 }), 0, 0);
          } catch (_) { /* unreadable image: plain grid */ }
          ready = true;
          if (m.dataset.wfIn) go();
        }
      };
      const go = () => {
        if (!ready || m.classList.contains("wf-go")) return;
        m.classList.add("wf-go");
        blip(1500, 0.04, 0.02);
        setTimeout(() => { cv.remove(); scan.remove(); m.classList.remove("wf", "wf-go"); }, 1500);
      };
      m._wfGo = go;
      if (img.complete && img.naturalWidth) draw();
      else { draw(); img.addEventListener("load", draw, { once: true }); img.addEventListener("error", () => { ready = true; go(); }, { once: true }); }
      io.observe(m);
    });
  }

  /* ---------- Asset Bay turntable: a drag-to-rotate ring of the pack's real images ---------- */
  function turntable(host, item) {
    const imgs = [item.image, ...(item.images || [])].filter(Boolean);
    if (!imgs.length) return null;
    // the wide breakdown strip (5 stages side by side) becomes five cards; the painting is one card
    const cards = [];
    imgs.forEach((src) => cards.push({ src, label: "Final painting" }));
    const strip = imgs.find((s, i) => i > 0);
    const im = new Image();
    const tt = mk("div", "turntable");
    tt.setAttribute("role", "img");
    tt.setAttribute("aria-label", `${item.title}: turntable of preview images — drag to rotate`);
    const ring = mk("div", "tt-ring");
    const floor = mk("div", "tt-floor");
    const hint = mk("span", "tt-hint", "Turntable · drag to rotate");
    tt.append(floor, ring, hint);
    host.append(tt);
    const build = (stages) => {
      ring.textContent = "";
      const list = [{ src: imgs[0], label: "Final painting", pos: null }];
      if (stages) for (let k = 0; k < 5; k++) list.push({ src: strip, label: `Breakdown ${k + 1}/5`, pos: k });
      else imgs.slice(1).forEach((s) => list.push({ src: s, label: "Preview", pos: null }));
      const n = list.length, step = 360 / n;
      list.forEach((c, i) => {
        const card = mk("figure", "tt-card");
        card.style.setProperty("--a", `${i * step}deg`);
        card.style.backgroundImage = `url("${c.src}")`;
        if (c.pos != null) { card.style.backgroundSize = "500% 100%"; card.style.backgroundPosition = `${c.pos * 25}% 50%`; }
        card.append(mk("figcaption", "", c.label));
        ring.append(card);
      });
      tt.style.setProperty("--n", n);
    };
    im.onload = () => build(strip && im.naturalWidth / im.naturalHeight > 4.5);
    im.onerror = () => build(false);
    if (strip) im.src = strip; else build(false);

    let ang = -20, vel = 0, drag = null, moved = 0, vis = true, last = performance.now();
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(tt);
    tt.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, a: ang, t: performance.now() }; moved = 0; vel = 0;
      tt.setPointerCapture(e.pointerId); tt.classList.add("grab");
    });
    tt.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      moved = Math.max(moved, Math.abs(dx));
      const na = drag.a + dx * 0.45;
      vel = (na - ang) * 0.6 + vel * 0.4;
      ang = na;
    });
    const up = () => { drag = null; tt.classList.remove("grab"); };
    tt.addEventListener("pointerup", up);
    tt.addEventListener("pointercancel", up);
    // a drag inside a link (home card) must not navigate
    tt.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    const tick = (now) => {
      if (gone) return;
      requestAnimationFrame(tick);
      const dt = Math.min(64, now - last) / 1000; last = now;
      if (!vis || document.hidden) return;
      if (!drag) {
        vel *= Math.pow(0.04, dt);
        ang += vel + (RM ? 0 : 9 * dt);
      }
      const tiltX = FINE && P.moved && !RM ? clamp((P.y / innerHeight - 0.5) * -10, -8, 8) : -6;
      ring.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(${tiltX - 8}deg) rotateY(${ang}deg)`;
    };
    requestAnimationFrame(tick);
    return tt;
  }

  /* ---------- Render settings easter egg (R, or Shift+?) ---------- */
  let panel = null, replay = null;
  function applySettings() {
    const b = document.body;
    b.dataset.shade = settings.shade;
    b.dataset.engine = settings.engine;
    b.style.setProperty("--light", settings.light);
    // low sample counts add visible noise; at 128+ the (costly) overlay layer is switched off entirely
    b.style.setProperty("--grain", settings.samples >= 128 ? 0 : (0.3 * (1 - Math.log2(Math.max(1, settings.samples)) / 7)).toFixed(3));
    b.classList.toggle("grainy", settings.samples < 128);
    b.dataset.tint = settings.tint;
  }
  function openPanel() {
    if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) $("select", panel).focus(); return; }
    panel = mk("aside", "rset");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Render settings");
    panel.innerHTML = `
      <header><b>Render Properties</b><span>Easter egg · press R to close</span><button type="button" class="rset-x" aria-label="Close">×</button></header>
      <label class="row"><span>Render Engine</span><select data-set="engine"><option value="cycles">Cycles</option><option value="eevee">EEVEE</option><option value="workbench">Workbench</option></select></label>
      <div class="row"><span>Viewport Shading</span><div class="seg" role="group" aria-label="Viewport shading">
        <button type="button" data-shade="wire">Wireframe</button><button type="button" data-shade="solid">Solid</button><button type="button" data-shade="rendered">Rendered</button></div></div>
      <label class="row"><span>Samples</span><input type="range" data-set="samples" min="0" max="10" step="1" value="7"><output>128</output></label>
      <label class="row"><span>Light Power</span><input type="range" data-set="light" min="0" max="200" step="5" value="100"><output>100%</output></label>
      <div class="row"><span>Light Colour</span><div class="seg" role="group" aria-label="Light colour">
        <button type="button" data-tint="warm">Warm</button><button type="button" data-tint="cool">Cool</button><button type="button" data-tint="white">White</button></div></div>
      <div class="row"><span>Hover Sounds</span><button type="button" class="tog" data-set="sound" aria-pressed="${soundOn}">${soundOn ? "On" : "Off"}</button></div>
      <footer><button type="button" class="rset-go" ${HOME ? "" : "disabled"}>Render Image <kbd>F12</kbd></button><button type="button" class="rset-reset">Reset</button></footer>`;
    document.body.append(panel);
    const sync = () => {
      $("select", panel).value = settings.engine;
      $$("[data-shade]", panel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shade === settings.shade)));
      $$("[data-tint]", panel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tint === settings.tint)));
      const s = $("[data-set=samples]", panel); s.value = Math.round(Math.log2(settings.samples)); s.nextElementSibling.value = settings.samples;
      const l = $("[data-set=light]", panel); l.value = Math.round(settings.light * 100); l.nextElementSibling.value = `${l.value}%`;
      applySettings();
    };
    panel.addEventListener("input", (e) => {
      const k = e.target.dataset.set;
      if (k === "samples") settings.samples = 2 ** +e.target.value;
      if (k === "light") settings.light = +e.target.value / 100;
      if (k === "engine") { settings.engine = e.target.value; if (settings.engine === "workbench") settings.shade = "solid"; else if (settings.shade === "solid") settings.shade = "rendered"; }
      sync();
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.shade) settings.shade = b.dataset.shade;
      if (b.dataset.tint) settings.tint = b.dataset.tint;
      if (b.dataset.set === "sound") setSound(!soundOn);
      if (b.classList.contains("rset-x")) { panel.hidden = true; return; }
      if (b.classList.contains("rset-reset")) Object.assign(settings, { light: 1, tint: "warm", samples: 128, shade: "rendered", engine: "cycles" });
      if (b.classList.contains("rset-go") && replay) { scrollTo({ top: 0, behavior: "instant" }); replay(); }
      sync();
    });
    sync();
    blip(520, 0.12, 0.05);
    $("select", panel).focus();
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest("input, textarea, select, [contenteditable], .modal, dialog[open]") && !(panel && panel.contains(t) && e.key === "Escape")) return;
    if (e.key === "Escape" && panel && !panel.hidden) { panel.hidden = true; return; }
    if ((e.key === "r" || e.key === "R" || e.key === "?") && !e.repeat) { e.preventDefault(); openPanel(); }
  });

  /* =========================================================
     Landing: opening, cursor light, 3D name, pullback
     ========================================================= */
  function landing() {
    const hook = window.hvRig;
    if (!hook) return;
    const box = hook.box, main = hook.canvas;
    const stage = $("#stage");
    // Wireframe / render-in overlay (low resolution, CSS-scaled)
    const fx = mk("canvas", "fx-open");
    fx.setAttribute("aria-hidden", "true");
    const fctx = fx.getContext("2d");
    const status = mk("span", "fx-status");
    status.setAttribute("aria-hidden", "true");
    // light rig
    const lights = mk("div", "lights");
    lights.setAttribute("aria-hidden", "true");
    const shadeL = mk("canvas", "lt-shade"), keyL = mk("canvas", "lt-key");
    const LW = 192, LH = 120;
    shadeL.width = keyL.width = LW; shadeL.height = keyL.height = LH;
    const sh = shadeL.getContext("2d"), kc = keyL.getContext("2d");
    const rim = mk("canvas", "lt-rim"), rctx = rim.getContext("2d");
    const grain = mk("i", "lt-grain");
    lights.append(shadeL, keyL, rim, grain);
    box.append(lights, fx, status);

    // current frame edge map (frame space), refreshed at most every 160 ms
    const EW = 328, EH = 216;
    const edgeCv = own(mk("canvas"));
    own(fx); own(shadeL); own(keyL); own(rim);
    let frame = null, edgesAt = 0, edgesDirty = true, haveEdges = false;
    let cur = null, curIdx = 0, sprite = null;
    hook.onPaint = (img, i) => { if (img) cur = img; if (i != null) curIdx = i; edgesDirty = true; };
    // Rim light edges are precomputed (assets/hero/rim-edges.webp: one edge map per
    // second frame, 8 per row). A worker turns the grey sprite into a warm,
    // alpha-only ImageBitmap so the main thread never reads pixels back.
    const loadSprite = () => {
      if (!window.Worker || !window.OffscreenCanvas) return;
      const code = `onmessage=async(e)=>{try{const r=await fetch(e.data);const b=await createImageBitmap(await r.blob());const c=new OffscreenCanvas(b.width,b.height);const x=c.getContext('2d');x.drawImage(b,0,0);b.close();const d=x.getImageData(0,0,b.width,b.height),p=d.data;for(let i=0;i<p.length;i+=4){p[i+3]=p[i];p[i]=255;p[i+1]=206;p[i+2]=160;}x.putImageData(d,0,0);const o=c.transferToImageBitmap();postMessage(o,[o]);}catch(err){postMessage(null);}}`;
      try {
        const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        const w = new Worker(url);
        w.onmessage = (e) => {
          w.terminate(); URL.revokeObjectURL(url);
          if (gone) { e.data && e.data.close && e.data.close(); return; }
          sprite = e.data; edgesDirty = true;
        };
        releaseSprite = () => { try { sprite && sprite.close && sprite.close(); } catch (_) {} sprite = null; w.terminate(); };
        w.postMessage(new URL("assets/hero/rim-edges.webp", location.href).href);
      } catch (_) {}
    };
    const SPR = { w: 328, h: 216, cols: 8, step: 2, count: 31 };
    const spriteCell = (ctx, dx, dy, dw, dh) => {
      const k = Math.max(0, Math.min(SPR.count - 1, Math.round(curIdx / SPR.step)));
      ctx.drawImage(sprite, (k % SPR.cols) * SPR.w, Math.floor(k / SPR.cols) * SPR.h, SPR.w, SPR.h, dx, dy, dw, dh);
    };
    const grabFrame = () => {
      // edge map of the visible part of the current frame (small, CPU side)
      const f = hook.fit, src = cur;
      if (!f || !src) return;
      try {
        const x0 = Math.max(0, f.x), x1 = Math.min(main.width, f.x + f.w);
        edgeMap(src, (x0 - f.x) / f.s, 0, (x1 - x0) / f.s, f.ih, EW, EH, edgeCv, { rgb: [255, 206, 160], thr: 64, k: 2.6 });
        haveEdges = true;
      } catch (_) {}
    };
    let rimBox = "";
    const placeRim = () => {
      const f = hook.fit;
      const key = f ? `${f.x}|${f.w}|${main.width}` : "full";
      if (key === rimBox) return;
      rimBox = key;
      const l = f ? Math.max(0, f.x) / main.width : 0, w = f ? Math.min(f.w, main.width) / main.width : 1;
      fx.dataset.l = l; fx.dataset.w = w;
    };

    // ---- opening ----
    let phase = RM ? "done" : "wire", t0 = 0, opening = !RM;
    const FW = 720, FH = 450;
    fx.width = FW; fx.height = FH;
    const small = own(mk("canvas")), sctx = small.getContext("2d");
    const noise = own(mk("canvas")); noise.width = noise.height = 128;
    (() => { const c = noise.getContext("2d"), d = c.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); })();
    const drawWire = (alpha) => {
      wireBackdrop(fctx, FW, FH, 24);
      const l = +(fx.dataset.l || 0), w = +(fx.dataset.w || 1);
      fctx.globalAlpha = alpha;
      if (sprite && phase === "done") spriteCell(fctx, l * FW, 0, w * FW, FH);
      else if (haveEdges) fctx.drawImage(edgeCv, l * FW, 0, w * FW, FH);
      fctx.globalAlpha = 1;
    };
    if (RM) fx.remove();
    else document.body.classList.add("opening");
    const startRender = () => {
      if (phase === "render") return;
      phase = "render"; t0 = performance.now(); opening = true;
      fx.style.opacity = "1"; fx.hidden = false;
      document.body.classList.add("opening", "rendering");
      // the head starts looking away and turns to face the visitor
      const ht0 = performance.now();
      hook.override = (now) => {
        const k = (now - ht0) / 2300;
        if (k >= 1) return null;
        return [0.08 + 0.42 * ease(k), 0.38 + 0.12 * ease(k)];
      };
    };
    replay = () => { if (!RM) { phase = "wire"; startRender(); } };
    document.addEventListener("hv:booted", () => setTimeout(startRender, RM ? 0 : 180), { once: true });
    if (!$("#boot")) setTimeout(startRender, 50);   // loader already gone

    // ---- 3D name ----
    const name = $(".stage-caption h1");
    if (name) {
      name.classList.add("x3d");
      $$("span", name).forEach((s) => s.setAttribute("data-t", s.textContent));
    }

    // ---- pullback ----
    const pull = $("#pull"), ws = $("#ws");
    let pullP = 0, wsApi = null, wsLoading = false;
    let panels = [];
    const caption = $(".stage-caption"), cue = $(".scroll-cue");
    const camFrame = mk("div", "cam-frame");
    camFrame.setAttribute("aria-hidden", "true");
    camFrame.innerHTML = "<span>Camera · Portrait.001</span><i></i>";
    stage.append(camFrame);
    const loadWs = () => {
      if (wsLoading || !ws) return;
      wsLoading = true;
      import("./objects.js?v=41").then((m) => { wsApi = m.workspace($(".ws-3d", ws)); wsApi.set(pullP); wsApi.active(pullP > 0.005); }).catch(() => {});
    };
    const onPull = () => {
      if (!pull) return;
      const r = pull.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      const p = clamp(-r.top / span);
      if (Math.abs(p - pullP) < 0.0005 && p !== 0 && p !== 1) return;
      pullP = p;
      const e = ease(p);
      stage.style.transform = p ? `translate3d(${-2.5 * e}vw, ${-3 * e}vh, 0) scale(${1 - 0.5 * e}) rotateX(${6 * e}deg) rotateY(${7 * e}deg)` : "";
      stage.classList.toggle("pulled", p > 0.01);
      if (caption) caption.style.opacity = String(clamp(1 - p * 3));
      if (caption) caption.style.pointerEvents = p > 0.2 ? "none" : "";
      if (cue) cue.style.opacity = String(clamp(1 - p * 6));
      camFrame.style.opacity = String(clamp((p - 0.15) * 3));
      if (!panels.length && ws) panels = $$(".ws-panel", ws);
      panels.forEach((n, i) => {
        const k = ease((p - 0.12 - i * 0.07) / 0.45);
        const [dx, dy] = (n.dataset.from || "0,0").split(",").map(Number);
        n.style.opacity = String(k);
        n.style.transform = `translate3d(${dx * (1 - k)}px, ${dy * (1 - k)}px, 0) rotateY(${(dx > 0 ? -18 : dx < 0 ? 18 : 0) * (1 - k)}deg)`;
        n.style.visibility = k > 0.01 ? "visible" : "hidden";
      });
      if (p > 0.002) loadWs();
      if (wsApi) { wsApi.set(p); wsApi.active(p > 0.005 && r.bottom > 0); }
    };
    if (pull && !RM) {
      window.hvPull = true;
      let queued = false;
      addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; onPull(); }); } }, { passive: true });
      addEventListener("resize", onPull);
      onPull();
    } else if (pull) pull.classList.add("calm");

    // ---- per-frame loop: opening, light, rim, name ----
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
    const L = { x: innerWidth * 0.62, y: innerHeight * 0.32 };
    const TINTS = { warm: ["255,226,196", "255,194,143"], cool: ["196,220,255", "120,160,255"], white: ["255,255,255", "235,235,240"] };
    let lightSet = "";
    let lastLight = "", lastName = "", rimKey = "", nameBox = null, nameAt = 0;
    addEventListener("resize", () => { nameBox = null; });
    const tick = (now) => {
      if (gone) return;
      requestAnimationFrame(tick);
      if (document.hidden || !visible) return;
      placeRim();
      // the opening's wireframe comes from one read of the first frame; afterwards the sprite is used
      if (!haveEdges && cur && edgesDirty) { edgesDirty = false; grabFrame(); }
      if (sprite && edgesDirty) { edgesDirty = false; rimKey = ""; }

      // opening overlay
      if (phase === "wire") drawWire(1);
      else if (phase === "render") {
        const k = (now - t0) / 1700;           // 0..1 over 1.7 s
        if (k >= 1.25) {
          phase = "done"; opening = false; fx.hidden = true;
          if (!sprite) { if ("requestIdleCallback" in window) requestIdleCallback(loadSprite, { timeout: 1500 }); else setTimeout(loadSprite, 300); }
          document.body.classList.remove("opening", "rendering");
          status.textContent = "";
        } else {
          // progressive samples: coarse blocks → fine, noise fades, wire lines fade
          const levels = [48, 32, 20, 12, 8, 5, 3, 2, 1];
          const blk = levels[Math.min(levels.length - 1, Math.floor(clamp(k) * levels.length))];
          const sw = Math.max(1, Math.round(FW / blk)), sh = Math.max(1, Math.round(FH / blk));
          if (small.width !== sw) { small.width = sw; small.height = sh; }
          sctx.drawImage(main, 0, 0, sw, sh);
          fctx.imageSmoothingEnabled = blk <= 2;
          fctx.globalAlpha = 1;
          fctx.drawImage(small, 0, 0, FW, FH);
          const nz = clamp(0.55 * (1 - k * 1.1), 0, 0.55);
          if (nz > 0) {
            fctx.globalAlpha = nz; fctx.globalCompositeOperation = "overlay";
            const ox = Math.random() * 128, oy = Math.random() * 128;
            fctx.fillStyle = fctx.createPattern(noise, "repeat");
            fctx.translate(-ox, -oy); fctx.fillRect(ox, oy, FW, FH); fctx.setTransform(1, 0, 0, 1, 0, 0);
            fctx.globalCompositeOperation = "source-over";
          }
          const wa = clamp(1 - k * 2.2);
          if (wa > 0 && haveEdges) { fctx.globalAlpha = wa; const l = +(fx.dataset.l || 0), w = +(fx.dataset.w || 1); fctx.drawImage(edgeCv, l * FW, 0, w * FW, FH); }
          fctx.globalAlpha = 1;
          fx.style.opacity = String(clamp(1 - (k - 1) * 4));
          const samples = Math.min(128, Math.round(2 ** (clamp(k) * 7)));
          status.textContent = k < 1 ? `Sample ${samples}/128 · Denoising ${k > 0.6 ? "on" : "…"}` : "Render complete";
        }
      }

      // render-settings "Wireframe" shading: live line art of the current frame
      if (phase === "done") {
        const wire = document.body.dataset.shade === "wire";
        if (wire && (fx.hidden || !rimKey)) { fx.hidden = false; fx.style.opacity = "1"; drawWire(1); }
        else if (!wire && !fx.hidden) fx.hidden = true;
      }

      // cursor light (smoothed); idles in a slow orbit until the mouse moves
      const br = box.getBoundingClientRect();
      const sc = br.width / box.offsetWidth || 1;
      let tx, ty;
      if (RM) { tx = innerWidth * 0.66; ty = innerHeight * 0.28; }
      else if (P.moved) { tx = (P.x - br.left) / sc; ty = (P.y - br.top) / sc; }
      else { const t = now / 1000; tx = box.offsetWidth * (0.55 + Math.sin(t * 0.5) * 0.2); ty = box.offsetHeight * (0.35 + Math.cos(t * 0.37) * 0.15); }
      L.x += (tx - L.x) * 0.2; L.y += (ty - L.y) * 0.2;
      const lx = Math.round(L.x), ly = Math.round(L.y);
      const settingsKey = `${settings.light}|${settings.tint}|${settings.engine}`;
      const key = `${lx}|${ly}`;
      if (key !== lastLight || settingsKey !== lightSet) {
        lastLight = key; lightSet = settingsKey;
        // light falloff + warm key, drawn at low resolution and scaled up by CSS
        const bw = box.offsetWidth || 1, bh = box.offsetHeight || 1;
        const cx = (lx / bw) * LW, cy = (ly / bh) * LH, pw = settings.light;
        sh.clearRect(0, 0, LW, LH);
        let g = sh.createRadialGradient(cx, cy, 0, cx, cy, LW * 0.75);
        const tint = TINTS[settings.tint] || TINTS.warm;
        // plain alpha only (no blend modes): a faint warm core, then falloff into shadow
        g.addColorStop(0, `rgba(${tint[0]},${(0.2 * Math.min(1.5, pw)).toFixed(3)})`);
        g.addColorStop(0.1, `rgba(${tint[1]},${(0.07 * Math.min(1.5, pw)).toFixed(3)})`);
        g.addColorStop(0.2, "rgba(6,6,10,0)");
        g.addColorStop(0.6, `rgba(6,6,10,${(0.5 * Math.min(1.4, pw)).toFixed(3)})`); g.addColorStop(1, `rgba(6,6,10,${(0.62 * Math.min(1.4, pw)).toFixed(3)})`);
        sh.fillStyle = g; sh.fillRect(0, 0, LW, LH);
        kc.clearRect(0, 0, LW, LH);
        if (settings.engine === "eevee") {
        g = kc.createRadialGradient(cx, cy * 1, 0, cx, cy, LW * 0.3);
        g.addColorStop(0, `rgba(${tint[0]},${Math.min(1, 0.95 * pw).toFixed(3)})`);
        g.addColorStop(0.35, `rgba(${tint[1]},${Math.min(1, 0.45 * pw).toFixed(3)})`);
        g.addColorStop(1, `rgba(${tint[1]},0)`);
        kc.fillStyle = g; kc.fillRect(0, 0, LW, LH);
        }
        rimKey = "";
      }
      if (!rimKey && sprite) {
        // only a small square around the light is drawn and composited (cheap)
        rimKey = key;
        const bw = box.offsetWidth || 1, bh = box.offsetHeight || 1;
        const l = +(fx.dataset.l || 0), w = +(fx.dataset.w || 1);
        const fw = w * bw, scale = EW / fw;                  // sprite px per CSS px
        const size = Math.round(fw * 0.62);                  // rim window in CSS px
        const RC = 200;
        if (rim.width !== RC) { rim.width = rim.height = RC; rim.style.width = rim.style.height = `${size}px`; }
        if (rim._size !== size) { rim._size = size; rim.style.width = rim.style.height = `${size}px`; }
        const ox = lx - size / 2, oy = ly - size / 2;
        rim.style.transform = `translate3d(${Math.round(ox)}px, ${Math.round(oy)}px, 0)`;
        // source rect in the sprite cell, clipped to the cell
        const k = Math.max(0, Math.min(SPR.count - 1, Math.round(curIdx / SPR.step)));
        const cellX = (k % SPR.cols) * SPR.w, cellY = Math.floor(k / SPR.cols) * SPR.h;
        let sx = (ox - l * bw) * scale, sy = oy * (EH / bh), ss = size * scale, ssy = size * (EH / bh);
        const d = RC / ss, dy = RC / ssy;
        let dx0 = 0, dy0 = 0, sw = ss, sh2 = ssy;
        if (sx < 0) { dx0 = -sx * d; sw += sx; sx = 0; }
        if (sy < 0) { dy0 = -sy * dy; sh2 += sy; sy = 0; }
        sw = Math.min(sw, SPR.w - sx); sh2 = Math.min(sh2, SPR.h - sy);
        rctx.clearRect(0, 0, RC, RC);
        if (sw > 1 && sh2 > 1) {
          rctx.globalCompositeOperation = "source-over";
          rctx.drawImage(sprite, cellX + sx, cellY + sy, sw, sh2, dx0, dy0, sw * d, sh2 * dy);
          rctx.globalCompositeOperation = "destination-in";
          const g = rctx.createRadialGradient(RC / 2, RC / 2, 0, RC / 2, RC / 2, RC / 2);
          g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.5, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
          rctx.fillStyle = g; rctx.fillRect(0, 0, RC, RC);
          rctx.globalCompositeOperation = "source-over";
        }
      }
      // 3D name tilts toward the light and its sheen follows it
      if (name && !RM && name.classList.contains("x3d")) {
        if (!nameBox || now - nameAt > 1500) {
          nameAt = now;
          const nr = name.getBoundingClientRect();
          nameBox = { l: (nr.left - br.left) / sc, t: (nr.top - br.top) / sc, w: nr.width / sc || 1, h: nr.height / sc || 1 };
        }
        const nx = clamp(lx / box.offsetWidth), ny = clamp(ly / box.offsetHeight);
        const sx = (lx - nameBox.l) / nameBox.w, sy = (ly - nameBox.t) / nameBox.h;
        const nk = `${Math.round(nx * 60)}|${Math.round(ny * 60)}`;
        if (nk !== lastName) {
          lastName = nk;
          name.style.transform = `perspective(900px) rotateX(${((0.5 - ny) * 16).toFixed(1)}deg) rotateY(${((nx - 0.5) * 22).toFixed(1)}deg)`;
          name.style.setProperty("--sx", `${Math.round(clamp(sx, -1, 2) * 100)}%`);
          name.style.setProperty("--sy", `${Math.round(clamp(sy, -1, 2) * 100)}%`);
        }
      }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- workspace panels (pullback) built from content ---------- */
  function buildWorkspace(c) {
    const ws = $("#ws");
    if (!ws || RM) return;
    const secs = (c.sections || []).filter((s) => !s.draft && s.nav !== false);
    const link = (s) => `page.html?s=${encodeURIComponent(s.id)}`;
    const vis = (s) => (s.items || []).filter((it) => it && String(it.title || "").trim() && !(it.draft === true || /^(yes|true)$/i.test(String(it.draft || ""))));
    const out = mk("div", "ws-panel ws-outliner"); out.dataset.from = "380,0";
    out.innerHTML = `<header>Outliner</header>`;
    const ul = mk("ul");
    const root = mk("li", "root"); root.textContent = "Scene Collection"; ul.append(root);
    const me = mk("li", "obj"); me.textContent = (c.site && c.site.name) || "Harshvir Wankhade"; ul.append(me);
    // same items and order as the top navigation
    $$("#rail a").forEach((n) => {
      const id = new URL(n.href, location.href).searchParams.get("s");
      const sec = secs.find((x) => x.id === id);
      const li = mk("li", "child");
      const a = mk("a", "", n.textContent.trim());
      a.href = n.getAttribute("href");
      const cnt = sec ? vis(sec).length : 0;
      li.append(a, mk("span", "cnt", cnt ? String(cnt) : ""));
      ul.append(li);
    });
    const ct = mk("li", "child"); const ca = mk("a", "", "Contact"); ca.href = "page.html?s=contact"; ct.append(ca); ul.append(ct);
    out.append(ul);

    const props = mk("div", "ws-panel ws-props"); props.dataset.from = "380,0";
    const ind = secs.find((s) => s.id === "industry"), uni = secs.find((s) => s.id === "universities");
    const rows = [
      ["Name", (c.site && c.site.name) || ""],
      ["Location", (c.contact && c.contact.location) || ""],
      ["Experience", ind && ind.years ? `${ind.years}+ years` : ""],
      ["Institutions", uni ? String(vis(uni).length) : ""],
      ["Studios", ind ? String(vis(ind).length) : ""],
    ].filter(([, v]) => v);
    props.innerHTML = `<header>Object Properties</header>`;
    const dl = mk("dl");
    rows.forEach(([k, v]) => dl.append(mk("dt", "", k), mk("dd", "", v)));
    props.append(dl);

    const tl = mk("div", "ws-panel ws-timeline"); tl.dataset.from = "0,220";
    tl.innerHTML = `<header>Timeline · Industry</header>`;
    const track = mk("div", "tl-track");
    const its = ind ? vis(ind) : [];
    const yrs = its.map((it) => (String(it.meta || "").match(/\d{4}/g) || []).map(Number)).filter((y) => y.length);
    const lo = Math.min(...yrs.flat(), 2019), hi = Math.max(...yrs.flat(), new Date().getFullYear());
    for (let y = lo; y <= hi; y++) { const t = mk("span", "tl-year", String(y)); t.style.left = `${((y - lo) / (hi - lo || 1)) * 100}%`; track.append(t); }
    its.forEach((it, i) => {
      const y = (String(it.meta || "").match(/\d{4}/) || [])[0];
      if (!y) return;
      const k = mk("span", "tl-key", it.title);
      k.style.left = `${((+y - lo) / (hi - lo || 1)) * 100}%`;
      k.style.top = `${30 + (i % 2) * 22}px`;
      track.append(k);
    });
    tl.append(track);
    const tools = mk("div", "ws-panel ws-tools"); tools.dataset.from = "-160,0";
    tools.innerHTML = '<i title="Select">⬚</i><i title="Move">✥</i><i title="Rotate">⟳</i><i title="Scale">⤢</i><i title="Light">☀</i><i title="Camera">◉</i>';
    tools.setAttribute("aria-hidden", "true");
    ws.append(tools, out, props, tl);
  }

  /* ---------- boot ---------- */
  document.addEventListener("hv:rig", () => { if (HOME) landing(); }, { once: true });
  document.addEventListener("hv:ready", () => {
    const c = window.hvContent || {};
    soundToggle();
    if (HOME) buildWorkspace(c);
    // Asset Bay turntables: home card + shop page
    const shopS = (c.sections || []).find((s) => s.layout === "shop");
    const item = shopS && (shopS.items || []).find((it) => it && !(it.draft === true || /^(yes|true)$/i.test(String(it.draft || ""))));
    if (item) {
      const bm = $(".bay-card .bay-media");
      if (bm) { bm.classList.add("has-tt"); turntable(bm, item); }
      if (document.body.dataset.section === shopS.id) {
        const wrap = mk("div", "tt-wrap");
        document.body.append(wrap);
        turntable(wrap, item);
      }
    }
    // wait for the first paint (and on the landing, the opening) before the rest
    const rest = () => {
      magnets();
      countUp($$(".cred-num b, .stat b"));
      wireReveals();
    };
    if (HOME && $("#boot")) document.addEventListener("hv:booted", () => setTimeout(rest, 400), { once: true });
    else requestAnimationFrame(() => setTimeout(rest, 0));
    applySettings();
  }, { once: true });
})();
