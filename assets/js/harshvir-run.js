/* Harshvir Run — pixel endless runner (secret unlock + 404). Canvas 2D only. */
(function (global) {
  "use strict";

  const HI_KEY = "hv_run_hi";
  const GOLD = "#d4af37";
  const TEAL = "#48a9a6";
  const BG = "#0b0c0e";
  const GROUND = "#1a1c20";
  const SKIN = "#c68642";
  const HAIR = "#1a1208";
  const JACKET = "#2f8f8c";
  const PANTS = "#2a2c30";
  const WHITE = "#e8e8ea";

  function prefersReduce() {
    try {
      if (new URLSearchParams(location.search).get("hvrun") === "play") return false;
    } catch (_) {}
    try {
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function readHi() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(HI_KEY) || "0", 10) || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeHi(n) {
    try {
      localStorage.setItem(HI_KEY, String(Math.max(0, n | 0)));
    } catch (_) {}
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /* ---------- Pixel drawer helpers (scale = pixel size) ---------- */
  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawPlayer(ctx, p, scale) {
    const s = scale;
    const x = p.x;
    const y = p.y;
    const jumping = p.vy < -0.5 || p.y + p.h < p.groundY - 2;
    // shadow
    ctx.fillStyle = "#00000055";
    ctx.beginPath();
    ctx.ellipse(x + p.w / 2, p.groundY + 2, p.w * 0.55, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    if (jumping) {
      px(ctx, x + 2 * s, y + 10 * s, 3 * s, 3 * s, PANTS);
      px(ctx, x + 7 * s, y + 10 * s, 3 * s, 3 * s, PANTS);
    } else {
      const gait = Math.sin(p.step) > 0;
      px(ctx, x + (gait ? 1 : 3) * s, y + 10 * s, 3 * s, 4 * s, PANTS);
      px(ctx, x + (gait ? 8 : 6) * s, y + 10 * s, 3 * s, 4 * s, PANTS);
      px(ctx, x + (gait ? 1 : 3) * s, y + 13 * s, 3 * s, 1 * s, "#111");
      px(ctx, x + (gait ? 8 : 6) * s, y + 13 * s, 3 * s, 1 * s, "#111");
    }
    // torso / teal jacket
    px(ctx, x + 2 * s, y + 5 * s, 8 * s, 6 * s, JACKET);
    px(ctx, x + 1 * s, y + 6 * s, 1 * s, 4 * s, TEAL);
    px(ctx, x + 10 * s, y + 6 * s, 1 * s, 4 * s, TEAL);
    // head
    px(ctx, x + 3 * s, y + 2 * s, 6 * s, 4 * s, SKIN);
    // hair spikes
    px(ctx, x + 2 * s, y + 0 * s, 2 * s, 3 * s, HAIR);
    px(ctx, x + 4 * s, y + 0 * s, 2 * s, 2 * s, HAIR);
    px(ctx, x + 6 * s, y + 0 * s, 2 * s, 3 * s, HAIR);
    px(ctx, x + 8 * s, y + 1 * s, 2 * s, 2 * s, HAIR);
    px(ctx, x + 3 * s, y + 2 * s, 6 * s, 1 * s, HAIR);
    // eye
    px(ctx, x + 7 * s, y + 3 * s, 1 * s, 1 * s, "#111");
  }

  function drawBrush(ctx, o, scale) {
    const s = scale;
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(o.rot || 0);
    // handle
    px(ctx, -1.5 * s, -8 * s, 3 * s, 12 * s, "#6b4423");
    px(ctx, -1 * s, -7 * s, 1 * s, 10 * s, "#8b5a2b");
    // ferrule
    px(ctx, -2.5 * s, 3 * s, 5 * s, 2 * s, "#c0c0c0");
    // bristles (gold)
    px(ctx, -3.5 * s, 5 * s, 7 * s, 5 * s, GOLD);
    px(ctx, -3 * s, 5 * s, 1 * s, 5 * s, "#f0d878");
    px(ctx, 2 * s, 5 * s, 1 * s, 5 * s, "#b8860b");
    ctx.restore();
  }

  function drawGlitch(ctx, o, scale, t) {
    const s = scale;
    const flicker = Math.floor(t * 12 + o.seed) % 3;
    px(ctx, o.x, o.y, o.w, o.h, flicker === 0 ? TEAL : "#2a5554");
    px(ctx, o.x + s, o.y + s, o.w - 2 * s, o.h - 2 * s, BG);
    px(ctx, o.x + 2 * s, o.y + 2 * s, o.w - 4 * s, o.h - 4 * s, flicker === 1 ? "#5ec4c1" : TEAL);
    // shatter particles
    for (let i = 0; i < 4; i++) {
      const pxOff = ((o.seed * 17 + i * 31 + t * 40) % 20) - 10;
      const pyOff = ((o.seed * 13 + i * 19 - t * 30) % 16) - 4;
      px(ctx, o.x + o.w + pxOff, o.y + pyOff, s, s, i % 2 ? TEAL : GOLD);
    }
  }

  function draw404Block(ctx, o, scale) {
    const s = scale;
    px(ctx, o.x, o.y, o.w, o.h, "#2a2c30");
    // caution stripes top + bottom
    const stripeH = Math.max(3, 2 * s);
    for (let i = 0; i < o.w; i += 8) {
      px(ctx, o.x + i, o.y, 4, stripeH, GOLD);
      px(ctx, o.x + i + 4, o.y, 4, stripeH, "#111");
      px(ctx, o.x + i, o.y + o.h - stripeH, 4, stripeH, GOLD);
      px(ctx, o.x + i + 4, o.y + o.h - stripeH, 4, stripeH, "#111");
    }
    ctx.fillStyle = GOLD;
    ctx.font = `bold ${Math.max(9, 3.2 * s)}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("404", o.x + o.w / 2, o.y + o.h / 2 - s);
    ctx.fillStyle = WHITE;
    ctx.font = `${Math.max(7, 2.2 * s)}px ui-monospace, Consolas, monospace`;
    ctx.fillText("NOT FOUND", o.x + o.w / 2, o.y + o.h / 2 + 2.5 * s);
  }

  function aabb(a, b) {
    const pad = 2;
    return (
      a.x + pad < b.x + b.w - pad &&
      a.x + a.w - pad > b.x + pad &&
      a.y + pad < b.y + b.h - pad &&
      a.y + a.h - pad > b.y + pad
    );
  }

  /* ---------- Core game ---------- */
  function createGame(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const state = {
      running: false,
      dead: false,
      waiting: true,
      score: 0,
      hi: readHi(),
      speed: 5.2,
      dist: 0,
      t: 0,
      scale: 3,
      groundY: 0,
      player: null,
      obstacles: [],
      particles: [],
      spawnIn: 90,
      raf: 0,
      last: 0,
      onHud: typeof opts.onHud === "function" ? opts.onHud : null,
      reduced: !!opts.reduced,
      inputArmed: !opts.reduced,
    };

    function layout() {
      const parent = canvas.parentElement;
      const w = Math.max(320, Math.min(900, (parent && parent.clientWidth) || 720));
      const h = Math.max(180, Math.min(360, Math.round(w * 0.42)));
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.viewW = w;
      state.viewH = h;
      state.scale = Math.max(2, Math.round(w / 240));
      state.groundY = h - 28;
      const s = state.scale;
      const pw = 12 * s;
      const ph = 14 * s;
      if (!state.player) {
        state.player = {
          x: Math.round(w * 0.18),
          y: state.groundY - ph,
          w: pw,
          h: ph,
          vy: 0,
          groundY: state.groundY - ph,
          step: 0,
        };
      } else {
        state.player.x = Math.round(w * 0.18);
        state.player.w = pw;
        state.player.h = ph;
        state.player.groundY = state.groundY - ph;
        if (!state.running || state.waiting) state.player.y = state.player.groundY;
      }
    }

    function reset() {
      state.dead = false;
      state.waiting = true;
      state.score = 0;
      state.dist = 0;
      state.speed = 5.2;
      state.t = 0;
      state.obstacles = [];
      state.particles = [];
      state.spawnIn = 70;
      state.hi = readHi();
      layout();
      state.player.y = state.player.groundY;
      state.player.vy = 0;
      hud();
      draw();
    }

    function hud() {
      if (state.onHud) state.onHud({ score: Math.floor(state.score), hi: state.hi, dead: state.dead, waiting: state.waiting });
    }

    function jump() {
      if (!state.inputArmed) return;
      if (state.dead) {
        reset();
        state.waiting = false;
        state.running = true;
        hud();
        return;
      }
      if (state.waiting) {
        state.waiting = false;
        state.running = true;
      }
      const p = state.player;
      if (p.y >= p.groundY - 1) {
        p.vy = -11.2 - Math.min(2.5, state.speed * 0.15);
      }
    }

    function spawn() {
      const s = state.scale;
      const roll = Math.random();
      let type, w, h, y;
      if (roll < 0.38) {
        type = "brush";
        w = 8 * s;
        h = 16 * s;
        y = state.groundY - h - (Math.random() < 0.35 ? 18 + Math.random() * 30 : 0);
      } else if (roll < 0.68) {
        type = "glitch";
        w = (8 + Math.random() * 6) * s;
        h = (8 + Math.random() * 8) * s;
        y = state.groundY - h;
      } else {
        type = "404";
        w = (22 + Math.random() * 8) * s;
        h = (16 + Math.random() * 6) * s;
        y = state.groundY - h;
      }
      state.obstacles.push({
        type,
        x: state.viewW + 20,
        y,
        w,
        h,
        rot: type === "brush" ? Math.random() * Math.PI : 0,
        spin: type === "brush" ? (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.12) : 0,
        seed: Math.random() * 1000,
      });
      state.spawnIn = Math.max(42, 95 - state.speed * 4) + Math.random() * 40;
    }

    function burst(x, y) {
      for (let i = 0; i < 14; i++) {
        state.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 5 - 1,
          life: 20 + Math.random() * 16,
          color: Math.random() < 0.5 ? TEAL : GOLD,
        });
      }
    }

    function die() {
      if (state.dead) return;
      state.dead = true;
      state.running = false;
      const sc = Math.floor(state.score);
      if (sc > state.hi) {
        state.hi = sc;
        writeHi(sc);
      }
      burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2);
      hud();
    }

    function tick(dt) {
      state.t += dt;
      const p = state.player;
      if (!state.waiting && !state.dead) {
        state.speed = Math.min(13, 5.2 + state.dist / 1800);
        state.dist += state.speed * dt * 60 * 0.35;
        state.score = state.dist;
        p.step += state.speed * 0.18 * dt * 60;
        p.vy += 0.55 * dt * 60;
        p.y += p.vy * dt * 60;
        if (p.y >= p.groundY) {
          p.y = p.groundY;
          p.vy = 0;
        }
        state.spawnIn -= dt * 60;
        if (state.spawnIn <= 0) spawn();
        for (const o of state.obstacles) {
          o.x -= state.speed * dt * 60;
          if (o.type === "brush") o.rot += o.spin * dt * 60;
        }
        state.obstacles = state.obstacles.filter((o) => o.x + o.w > -40);
        const hitbox = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 3 };
        for (const o of state.obstacles) {
          if (aabb(hitbox, o)) {
            die();
            break;
          }
        }
      }
      for (const q of state.particles) {
        q.x += q.vx * dt * 60;
        q.y += q.vy * dt * 60;
        q.vy += 0.25 * dt * 60;
        q.life -= dt * 60;
      }
      state.particles = state.particles.filter((q) => q.life > 0);
      hud();
    }

    function drawGround(scroll) {
      const w = state.viewW;
      const gy = state.groundY + state.player.h;
      px(ctx, 0, gy, w, state.viewH - gy, GROUND);
      px(ctx, 0, gy, w, 2, "#2e3138");
      ctx.fillStyle = "#25282e";
      const step = 16;
      const off = -((scroll * 0.8) % step);
      for (let x = off; x < w; x += step) {
        px(ctx, x, gy + 6, 8, 2, "#22252b");
      }
      // faint teal dotted curves
      ctx.strokeStyle = "#48a9a633";
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = 40 + i * 36;
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 20) {
          ctx.lineTo(x, y + Math.sin((x + scroll) * 0.02 + i) * 8);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function draw() {
      const w = state.viewW;
      const h = state.viewH;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      drawGround(state.dist);
      for (const o of state.obstacles) {
        if (o.type === "brush") drawBrush(ctx, o, state.scale);
        else if (o.type === "glitch") drawGlitch(ctx, o, state.scale, state.t);
        else draw404Block(ctx, o, state.scale);
      }
      drawPlayer(ctx, state.player, state.scale);
      for (const q of state.particles) {
        px(ctx, q.x, q.y, 3, 3, q.color);
      }
      // overlay texts on canvas (backup; HUD also in DOM)
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = GOLD;
      ctx.font = "600 14px Inter Tight, Inter, system-ui, sans-serif";
      ctx.fillText("SCORE  " + Math.floor(state.score).toLocaleString(), 14, 12);
      ctx.fillStyle = TEAL;
      ctx.fillText("HI  " + state.hi.toLocaleString(), 14, 32);

      if (state.waiting && !state.dead) {
        ctx.fillStyle = "#00000088";
        ctx.fillRect(0, h * 0.35, w, 54);
        ctx.textAlign = "center";
        ctx.fillStyle = WHITE;
        ctx.font = "600 16px Archivo, Inter Tight, system-ui, sans-serif";
        ctx.fillText("Harshvir Run", w / 2, h * 0.35 + 10);
        ctx.fillStyle = "#9a9b9f";
        ctx.font = "400 12px Inter Tight, system-ui, sans-serif";
        ctx.fillText("Space / tap to jump — Run. Jump. Create. Don't crash.", w / 2, h * 0.35 + 32);
      }
      if (state.dead) {
        ctx.fillStyle = "#00000099";
        ctx.fillRect(0, h * 0.32, w, 70);
        ctx.textAlign = "center";
        ctx.fillStyle = GOLD;
        ctx.font = "700 18px Archivo, Inter Tight, system-ui, sans-serif";
        ctx.fillText("Crashed", w / 2, h * 0.32 + 14);
        ctx.fillStyle = WHITE;
        ctx.font = "400 13px Inter Tight, system-ui, sans-serif";
        ctx.fillText("Score " + Math.floor(state.score).toLocaleString() + " · Space / tap to try again", w / 2, h * 0.32 + 42);
      }
    }

    function frame(now) {
      if (!state.raf && !state.running && state.dead) {
        // still animate particles after death briefly
      }
      if (!state.last) state.last = now;
      let dt = (now - state.last) / 1000;
      state.last = now;
      dt = clamp(dt, 0, 0.05);
      if (state.running || state.particles.length || state.dead) tick(dt);
      else if (!state.waiting) tick(dt);
      draw();
      state.raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (state.raf) return;
      state.last = 0;
      state.raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
      state.running = false;
    }

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) jump();
      }
    }

    function onPointer(e) {
      if (e && e.target && e.target.closest && e.target.closest("button, a")) return;
      e.preventDefault();
      jump();
    }

    layout();
    reset();
    canvas.addEventListener("pointerdown", onPointer);
    // Always draw at least once
    draw();

    return {
      canvas,
      jump,
      reset,
      layout,
      armInput() { state.inputArmed = true; },
      start() {
        state.inputArmed = true;
        state.waiting = false;
        state.running = true;
        state.dead = false;
        startLoop();
        hud();
      },
      ready() {
        startLoop();
        hud();
      },
      pause() {
        state.running = false;
      },
      destroy() {
        stopLoop();
        canvas.removeEventListener("pointerdown", onPointer);
        document.removeEventListener("keydown", onKey);
      },
      bindKeys() {
        document.addEventListener("keydown", onKey);
      },
      unbindKeys() {
        document.removeEventListener("keydown", onKey);
      },
      getScore() {
        return Math.floor(state.score);
      },
      getHi() {
        return state.hi;
      },
    };
  }

  /* ---------- Overlay (home secret) ---------- */
  let overlay = null;
  let overlayGame = null;
  let lastFocus = null;

  function ensureCss() {
    if (document.querySelector('link[data-hv-run], style[data-hv-run]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/harshvir-run.css?v=1";
    link.setAttribute("data-hv-run", "1");
    document.head.appendChild(link);
  }

  function buildShell(kind) {
    const root = document.createElement("div");
    root.className = "hv-run" + (kind === "overlay" ? " hv-run--overlay" : " hv-run--page");
    root.innerHTML = `
      <div class="hv-run__panel" role="dialog" aria-modal="${kind === "overlay" ? "true" : "false"}" aria-label="Harshvir Run">
        <header class="hv-run__head">
          <div class="hv-run__brand">
            <span class="hv-run__logo" aria-hidden="true"></span>
            <div>
              <strong>Harshvir Run</strong>
              <p>Run. Jump. Create. Don't crash.</p>
            </div>
          </div>
          <div class="hv-run__scores">
            <span class="hv-run__score"><i aria-hidden="true"></i><b data-hv-score>0</b><small>SCORE</small></span>
            <span class="hv-run__hi"><i aria-hidden="true"></i><b data-hv-hi>0</b><small>HIGH SCORE</small></span>
          </div>
          ${kind === "overlay" ? '<button type="button" class="hv-run__close" aria-label="Close">Close</button>' : ""}
        </header>
        <div class="hv-run__stage">
          <canvas class="hv-run__canvas" width="720" height="300" aria-label="Harshvir Run game"></canvas>
          <div class="hv-run__calm" hidden>
            <p>Motion is reduced on this device.</p>
            <button type="button" class="hv-run__play">Play Harshvir Run</button>
          </div>
        </div>
        <footer class="hv-run__foot">
          <span><kbd>Space</kbd> / tap to jump</span>
          <span class="hv-run__tag">Built for creators who keep building.</span>
          ${kind === "page" ? '<a class="hv-run__home" href="./">Back to site</a>' : '<button type="button" class="hv-run__home" data-hv-close>Back to site</button>'}
        </footer>
      </div>`;
    return root;
  }

  function wireHud(root, game) {
    const scoreEl = root.querySelector("[data-hv-score]");
    const hiEl = root.querySelector("[data-hv-hi]");
    return function onHud(h) {
      if (scoreEl) scoreEl.textContent = h.score.toLocaleString();
      if (hiEl) hiEl.textContent = h.hi.toLocaleString();
    };
  }

  function trapFocus(panel, e) {
    if (e.key !== "Tab") return;
    const focusables = panel.querySelectorAll('button, a[href], canvas, [tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function closeOverlay() {
    if (!overlay) return;
    if (overlayGame) {
      overlayGame.unbindKeys();
      overlayGame.destroy();
      overlayGame = null;
    }
    document.removeEventListener("keydown", onOverlayKey, true);
    global.removeEventListener("resize", onResizeOverlay);
    overlay.remove();
    overlay = null;
    document.body.classList.remove("hv-run-open");
    if (lastFocus && lastFocus.focus) {
      try {
        lastFocus.focus();
      } catch (_) {}
    }
    lastFocus = null;
  }

  function onOverlayKey(e) {
    if (!overlay) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
      return;
    }
    const panel = overlay.querySelector(".hv-run__panel");
    if (panel) trapFocus(panel, e);
  }

  function openOverlay() {
    ensureCss();
    if (overlay) {
      closeOverlay();
    }
    lastFocus = document.activeElement;
    overlay = buildShell("overlay");
    document.body.appendChild(overlay);
    document.body.classList.add("hv-run-open");
    const panel = overlay.querySelector(".hv-run__panel");
    const canvas = overlay.querySelector("canvas");
    const calm = overlay.querySelector(".hv-run__calm");
    const playBtn = overlay.querySelector(".hv-run__play");
    const reduced = prefersReduce();

    const hudFn = wireHud(overlay, null);
    overlayGame = createGame(canvas, { onHud: hudFn, reduced });
    overlayGame.bindKeys();
    overlayGame.ready();

    if (reduced) {
      calm.hidden = false;
      playBtn.addEventListener("click", () => {
        calm.hidden = true;
        overlayGame.armInput();
        overlayGame.start();
        canvas.focus();
      });
    } else {
      calm.hidden = true;
    }

    overlay.querySelectorAll(".hv-run__close, [data-hv-close]").forEach((btn) => {
      btn.addEventListener("click", closeOverlay);
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", onOverlayKey, true);
    global.addEventListener("resize", onResizeOverlay);
    requestAnimationFrame(() => {
      layoutSafe(overlayGame);
      (overlay.querySelector(".hv-run__close") || canvas).focus();
    });
  }

  function onResizeOverlay() {
    if (overlayGame) layoutSafe(overlayGame);
  }

  function layoutSafe(game) {
    try {
      game.layout();
    } catch (_) {}
  }

  /* ---------- Inline mount (404) ---------- */
  function mountInline(container, opts) {
    opts = opts || {};
    ensureCss();
    const root = buildShell("page");
    container.appendChild(root);
    const canvas = root.querySelector("canvas");
    const calm = root.querySelector(".hv-run__calm");
    const playBtn = root.querySelector(".hv-run__play");
    const reduced = prefersReduce() || !!opts.forceCalm;
    const hudFn = wireHud(root, null);
    const game = createGame(canvas, { onHud: hudFn, reduced });
    game.bindKeys();
    game.ready();
    if (reduced) {
      calm.hidden = false;
      playBtn.addEventListener("click", () => {
        calm.hidden = true;
        game.armInput();
        game.start();
      });
    } else if (opts.autoStart !== false) {
      // waiting for first jump — already ready
      calm.hidden = true;
    }
    global.addEventListener("resize", () => layoutSafe(game));
    requestAnimationFrame(() => layoutSafe(game));
    return game;
  }

  /* ---------- Home unlock: click brand initials 5× within 2s ---------- */
  function initHomeUnlock() {
    ensureCss();
    let clicks = 0;
    let timer = 0;
    const RESET_MS = 2000;
    const NEED = 5;

    function onBrandClick(e) {
      const b = e.target.closest && e.target.closest(".brand b");
      if (!b) return;
      // Only count the initials glyph, not the whole name link text
      e.preventDefault();
      e.stopPropagation();
      clicks += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        clicks = 0;
        timer = 0;
      }, RESET_MS);
      if (clicks >= NEED) {
        clicks = 0;
        if (timer) clearTimeout(timer);
        timer = 0;
        openOverlay();
      }
    }

    // Capture so we beat the link navigation on home
    document.addEventListener("click", onBrandClick, true);
  }

  // Auto-init unlock on home
  function boot() {
    if (document.body && document.body.classList.contains("home")) {
      initHomeUnlock();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.HarshvirRun = {
    createGame,
    openOverlay,
    closeOverlay,
    mountInline,
    initHomeUnlock,
    HI_KEY,
  };
})(window);
