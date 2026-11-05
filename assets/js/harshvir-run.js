/* Harshvir Run — cozy HD pixel endless runner + conversion layer (secret + 404). */
(function (global) {
  "use strict";

  const HI_KEY = "hv_run_hi";
  const CODE_KEY = "hv_run_code_unlocked";
  const CFG = global.HV_RUN_CONFIG || {};

  const BASE = {
    cloud: "#ffffff",
    cloudShade: "#e8f4ff",
    dirt: "#c4a06a",
    dirtDark: "#9a7848",
    path: "#d4b888",
    wood: "#8b5a2b",
    woodLite: "#b87840",
    woodDark: "#5c3a18",
    thatch: "#a67c3a",
    thatchDark: "#7a5528",
    leaf: "#3d9a2e",
    fruit: "#f0a030",
    stone: "#8a8e86",
    stoneMoss: "#5a8a48",
    stoneDark: "#5a5e56",
    hair: "#2a1c12",
    skin: "#e8b090",
    skinShade: "#d4946e",
    shirt: "#3a9a96",
    shirtLite: "#5cb8b4",
    shorts: "#3a3c48",
    shoe: "#f5f5f0",
    catOrange: "#e88830",
    catLite: "#f0a858",
    catWhite: "#fff6e8",
    catNose: "#e87878",
    titleEdge: "#5a3a10",
    plaque: "#c9a06a",
    plaqueDark: "#8b6238",
    plaqueInk: "#3a2810",
    white: "#fffef8",
    pumpkin: "#e87820",
    pumpkinDark: "#c45810",
    stem: "#4a7a28",
    orb: "#7ec8ff",
    orbCore: "#fff8e0",
  };

  function resolveThemeId() {
    const themes = CFG.themes || {};
    let id = CFG.theme || "default";
    if (id === "auto") {
      const today = new Date().toISOString().slice(0, 10);
      const wins = CFG.themeWindows || [];
      id = "default";
      for (const w of wins) {
        if (w && w.id && w.start && w.end && today >= w.start && today <= w.end && themes[w.id]) {
          id = w.id;
          break;
        }
      }
    }
    if (!themes[id]) id = "default";
    return id;
  }

  function buildPalette() {
    const id = resolveThemeId();
    const t = (CFG.themes && CFG.themes[id]) || {};
    return Object.assign({}, BASE, {
      skyTop: t.skyTop || "#7ec8f5",
      skyBot: t.skyBot || "#c8e8ff",
      grass: t.grass || "#6bcb3a",
      grassDark: t.grassDark || "#4fa82a",
      grassLite: t.grassLite || "#8fe05a",
      sakura: t.sakura || "#f7b6c8",
      sakuraDeep: t.sakuraDeep || "#e8899e",
      title: t.title || "#f5d04a",
      petalA: t.petalA || t.sakura || "#f7b6c8",
      petalB: t.petalB || t.sakuraDeep || "#e8899e",
      _themeId: id,
      _overlayBg: t.overlayBg || "",
      _pageBg: t.pageBg || "",
    });
  }

  let C = buildPalette();

  function hvTrack(type, meta) {
    try {
      if (global.hvAnalytics && typeof global.hvAnalytics.track === "function") {
        global.hvAnalytics.track(type, meta || {});
      }
    } catch (_) {}
  }

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

  function readCodeUnlock() {
    try {
      const raw = localStorage.getItem(CODE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeCodeUnlock(payload) {
    try {
      localStorage.setItem(CODE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function codeStillValid() {
    const exp = CFG.codeExpiresISO;
    if (!exp) return true;
    try {
      return new Date().toISOString().slice(0, 10) <= String(exp);
    } catch (_) {
      return true;
    }
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function pickTip() {
    const tips = CFG.loreTips || [];
    if (!tips.length) return "Creators who keep building get the high score that matters.";
    return tips[Math.floor(Math.random() * tips.length)];
  }

  function ctaSet(source) {
    const map = CFG.ctaBySource || {};
    return map[source] || map.secret || {};
  }

  /* ---------- Sprites ---------- */
  function drawBoy(ctx, p, s) {
    const x = p.x;
    const y = p.y;
    const jumping = p.vy < -0.4 || p.y + p.h < p.groundY - 2;
    const gait = Math.sin(p.step) > 0;
    ellipse(ctx, x + p.w / 2, p.groundY + p.h + 2, p.w * 0.45, 3, "#00000022");
    if (jumping) {
      px(ctx, x + 3 * s, y + 12 * s, 3 * s, 3 * s, C.shorts);
      px(ctx, x + 8 * s, y + 12 * s, 3 * s, 3 * s, C.shorts);
      px(ctx, x + 3 * s, y + 14 * s, 3 * s, 1 * s, C.shoe);
      px(ctx, x + 8 * s, y + 14 * s, 3 * s, 1 * s, C.shoe);
    } else {
      const l = gait ? 2 : 4;
      const r = gait ? 9 : 7;
      px(ctx, x + l * s, y + 12 * s, 3 * s, 4 * s, C.shorts);
      px(ctx, x + r * s, y + 12 * s, 3 * s, 4 * s, C.shorts);
      px(ctx, x + l * s, y + 15 * s, 3 * s, 1 * s, C.shoe);
      px(ctx, x + r * s, y + 15 * s, 3 * s, 1 * s, C.shoe);
    }
    px(ctx, x + 3 * s, y + 7 * s, 8 * s, 6 * s, C.shirt);
    px(ctx, x + 3 * s, y + 7 * s, 8 * s, 1 * s, C.shirtLite);
    px(ctx, x + 2 * s, y + 8 * s, 1 * s, 4 * s, C.shirt);
    px(ctx, x + 11 * s, y + 8 * s, 1 * s, 4 * s, C.shirt);
    px(ctx, x + 4 * s, y + 3 * s, 6 * s, 5 * s, C.skin);
    px(ctx, x + 4 * s, y + 6 * s, 6 * s, 1 * s, C.skinShade);
    px(ctx, x + 3 * s, y + 1 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 5 * s, y + 0 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 7 * s, y + 1 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 9 * s, y + 2 * s, 2 * s, 2 * s, C.hair);
    px(ctx, x + 4 * s, y + 3 * s, 6 * s, 1 * s, C.hair);
    px(ctx, x + 5 * s, y + 5 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 8 * s, y + 5 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 6 * s, y + 6 * s, 2 * s, 1 * s, C.skinShade);
  }

  function drawCat(ctx, cat, s) {
    const x = cat.x;
    const y = cat.y;
    const gait = Math.sin(cat.step) > 0;
    ellipse(ctx, x + 5 * s, cat.groundY + 2, 5 * s, 2, "#00000018");
    px(ctx, x + 2 * s, y + 3 * s, 8 * s, 4 * s, C.catOrange);
    px(ctx, x + 3 * s, y + 4 * s, 5 * s, 2 * s, C.catLite);
    px(ctx, x + 7 * s, y + 1 * s, 5 * s, 4 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 2 * s, 3 * s, 2 * s, C.catLite);
    px(ctx, x + 7 * s, y + 0 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 10 * s, y + 0 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 1 * s, 1 * s, 1 * s, C.catNose);
    px(ctx, x + 8 * s, y + 2 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 10 * s, y + 2 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 9 * s, y + 3 * s, 1 * s, 1 * s, C.catNose);
    px(ctx, x + 4 * s, y + 5 * s, 3 * s, 2 * s, C.catWhite);
    const a = gait ? 2 : 3;
    const b = gait ? 6 : 5;
    px(ctx, x + a * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + b * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 0 * s, y + 2 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 0 * s, y + 1 * s, 1 * s, 2 * s, C.catLite);
  }

  function drawObstacle(ctx, o, s) {
    if (o.type === "404") drawStone404(ctx, o, s);
    else if (o.type === "fence") drawFence(ctx, o, s);
    else if (o.type === "brush") drawBrush(ctx, o, s);
    else if (o.type === "pumpkin") drawPumpkin(ctx, o, s);
    else if (o.type === "easel") drawEasel(ctx, o, s);
  }

  function drawStone404(ctx, o, s) {
    const x = o.x;
    const y = o.y;
    px(ctx, x + 1 * s, y + 1 * s, o.w - 2 * s, o.h - 1 * s, C.stone);
    px(ctx, x, y + 2 * s, 1 * s, o.h - 3 * s, C.stoneDark);
    px(ctx, x + o.w - 1 * s, y + 2 * s, 1 * s, o.h - 3 * s, C.stoneDark);
    px(ctx, x + 2 * s, y, o.w - 4 * s, 2 * s, C.stoneMoss);
    px(ctx, x + 1 * s, y + 3 * s, 2 * s, 2 * s, C.stoneMoss);
    px(ctx, x + o.w - 4 * s, y + o.h - 4 * s, 3 * s, 2 * s, C.stoneMoss);
    ctx.fillStyle = C.plaqueInk;
    ctx.font = `bold ${Math.max(10, 3.4 * s)}px ui-monospace, "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("404", x + o.w / 2, y + o.h / 2 + s);
  }

  function drawFence(ctx, o, s) {
    const x = o.x;
    const y = o.y;
    px(ctx, x + 2 * s, y + 2 * s, 3 * s, o.h - 2 * s, C.wood);
    px(ctx, x + 2 * s, y + 2 * s, 1 * s, o.h - 2 * s, C.woodLite);
    px(ctx, x + 1 * s, y, 5 * s, 3 * s, C.woodDark);
    px(ctx, x + 3 * s, y + 1 * s, 1 * s, 1 * s, C.title);
    px(ctx, x, y + 8 * s, o.w, 2 * s, C.woodLite);
  }

  function drawBrush(ctx, o, s) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(o.rot || -0.25);
    px(ctx, -1.5 * s, -10 * s, 3 * s, 14 * s, C.wood);
    px(ctx, -1 * s, -9 * s, 1 * s, 12 * s, C.woodLite);
    px(ctx, -3 * s, 3 * s, 6 * s, 2 * s, "#c0a060");
    px(ctx, -4 * s, 5 * s, 8 * s, 5 * s, C.title);
    px(ctx, -3 * s, 5 * s, 1 * s, 5 * s, "#fff0a0");
    ctx.restore();
  }

  function drawPumpkin(ctx, o, s) {
    const x = o.x;
    const y = o.y;
    ellipse(ctx, x + o.w / 2, y + o.h * 0.6, o.w * 0.48, o.h * 0.42, C.pumpkin);
    px(ctx, x + o.w * 0.45, y + 1 * s, 2 * s, 3 * s, C.stem);
    px(ctx, x + o.w * 0.2, y + o.h * 0.35, 1 * s, o.h * 0.4, C.pumpkinDark);
    px(ctx, x + o.w * 0.5, y + o.h * 0.3, 1 * s, o.h * 0.45, C.pumpkinDark);
    px(ctx, x + o.w * 0.75, y + o.h * 0.35, 1 * s, o.h * 0.4, C.pumpkinDark);
  }

  function drawEasel(ctx, o, s) {
    const x = o.x;
    const y = o.y;
    px(ctx, x + 1 * s, y + 6 * s, 2 * s, o.h - 6 * s, C.woodDark);
    px(ctx, x + o.w - 3 * s, y + 6 * s, 2 * s, o.h - 6 * s, C.woodDark);
    px(ctx, x + o.w / 2 - s, y + 8 * s, 2 * s, o.h - 8 * s, C.wood);
    px(ctx, x + 1 * s, y + 1 * s, o.w - 2 * s, 10 * s, C.white);
    px(ctx, x + 1 * s, y + 1 * s, o.w - 2 * s, 1 * s, C.wood);
    px(ctx, x + 1 * s, y + 10 * s, o.w - 2 * s, 1 * s, C.wood);
    px(ctx, x + 3 * s, y + 3 * s, 4 * s, 3 * s, C.skyTop);
    px(ctx, x + 3 * s, y + 5 * s, 5 * s, 3 * s, C.grass);
    px(ctx, x + 7 * s, y + 4 * s, 2 * s, 2 * s, C.sakura);
  }

  function drawOrb(ctx, tok, s, t) {
    const pulse = 1 + Math.sin(t * 6 + tok.seed) * 0.12;
    const r = tok.r * pulse;
    ellipse(ctx, tok.x, tok.y, r * 1.1, r * 0.9, C.orb + "55");
    ellipse(ctx, tok.x, tok.y, r * 0.7, r * 0.55, C.orb);
    ellipse(ctx, tok.x - r * 0.2, tok.y - r * 0.15, r * 0.25, r * 0.2, C.orbCore);
  }

  function drawCottage(ctx, x, gy, scale) {
    const s = scale * 0.55;
    const baseY = gy - 38 * s;
    px(ctx, x, baseY + 12 * s, 42 * s, 26 * s, "#e8d2a8");
    px(ctx, x + 2 * s, baseY + 14 * s, 38 * s, 22 * s, "#f0e0b8");
    px(ctx, x - 4 * s, baseY + 4 * s, 50 * s, 12 * s, C.thatch);
    px(ctx, x - 2 * s, baseY + 2 * s, 46 * s, 4 * s, C.thatchDark);
    px(ctx, x + 6 * s, baseY, 30 * s, 4 * s, C.thatch);
    px(ctx, x + 32 * s, baseY - 2 * s, 6 * s, 10 * s, C.stone);
    px(ctx, x + 31 * s, baseY - 3 * s, 8 * s, 2 * s, C.stoneDark);
    px(ctx, x + 8 * s, baseY + 22 * s, 8 * s, 16 * s, C.woodDark);
    px(ctx, x + 24 * s, baseY + 18 * s, 10 * s, 8 * s, "#a8d8f0");
    px(ctx, x + 24 * s, baseY + 18 * s, 10 * s, 1 * s, C.wood);
    px(ctx, x + 28 * s, baseY + 18 * s, 1 * s, 8 * s, C.wood);
  }

  function drawSakuraTree(ctx, x, gy, scale, flip) {
    const s = scale * 0.5;
    const dir = flip ? -1 : 1;
    px(ctx, x, gy - 28 * s, 3 * s, 28 * s, C.woodDark);
    px(ctx, x + dir * 4 * s, gy - 22 * s, 8 * s, 2 * s, C.wood);
    ellipse(ctx, x + dir * 2 * s, gy - 34 * s, 16 * s, 12 * s, C.sakura);
    ellipse(ctx, x - dir * 8 * s, gy - 30 * s, 10 * s, 8 * s, C.sakuraDeep);
    ellipse(ctx, x + dir * 10 * s, gy - 28 * s, 9 * s, 7 * s, C.sakura);
    ellipse(ctx, x + dir * 1 * s, gy - 40 * s, 8 * s, 6 * s, "#fde0ea");
  }

  function drawFruitTree(ctx, x, gy, scale) {
    const s = scale * 0.45;
    px(ctx, x, gy - 22 * s, 2 * s, 22 * s, C.woodDark);
    ellipse(ctx, x + s, gy - 26 * s, 12 * s, 10 * s, C.leaf);
    ellipse(ctx, x - 6 * s, gy - 22 * s, 7 * s, 6 * s, "#4aad35");
    for (let i = 0; i < 5; i++) {
      px(ctx, x - 6 * s + i * 3.5 * s, gy - 28 * s + (i % 2) * 4 * s, 2 * s, 2 * s, C.fruit);
    }
  }

  function drawCloud(ctx, x, y, s) {
    ellipse(ctx, x, y, 18 * s, 8 * s, C.cloud);
    ellipse(ctx, x - 12 * s, y + 2 * s, 10 * s, 6 * s, C.cloud);
    ellipse(ctx, x + 14 * s, y + 1 * s, 12 * s, 7 * s, C.cloudShade);
  }

  /* ---------- Core game ---------- */
  function createGame(canvas, opts) {
    opts = opts || {};
    C = buildPalette();
    const ctx = canvas.getContext("2d");
    const source = opts.source === "404" ? "404" : "secret";
    const maxTokens = Math.max(1, (CFG.maxTokensPerRun | 0) || 5);
    const unlockScore = Math.max(1, (CFG.unlockScore | 0) || 500);
    const state = {
      running: false,
      dead: false,
      waiting: true,
      score: 0,
      hi: readHi(),
      speed: 4.6,
      dist: 0,
      t: 0,
      scale: 3,
      groundY: 0,
      player: null,
      cat: null,
      obstacles: [],
      tokens: [],
      tokensCollected: 0,
      tokensSpawned: 0,
      petals: [],
      particles: [],
      spawnIn: 90,
      tokenSpawnIn: 70,
      raf: 0,
      last: 0,
      onHud: typeof opts.onHud === "function" ? opts.onHud : null,
      onGameOver: typeof opts.onGameOver === "function" ? opts.onGameOver : null,
      onStart: typeof opts.onStart === "function" ? opts.onStart : null,
      onToken: typeof opts.onToken === "function" ? opts.onToken : null,
      reduced: !!opts.reduced,
      inputArmed: !opts.reduced,
      startedOnce: false,
      source,
      viewW: 720,
      viewH: 300,
      convertLocked: false,
    };

    function layout() {
      const parent = canvas.parentElement;
      const w = Math.max(320, Math.min(920, (parent && parent.clientWidth) || 720));
      const h = Math.max(200, Math.min(400, Math.round(w * 0.46)));
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.viewW = w;
      state.viewH = h;
      state.scale = Math.max(2, Math.round(w / 260));
      state.groundY = h - 36;
      const s = state.scale;
      const pw = 14 * s;
      const ph = 16 * s;
      if (!state.player) {
        state.player = {
          x: Math.round(w * 0.2),
          y: state.groundY - ph,
          w: pw,
          h: ph,
          vy: 0,
          groundY: state.groundY - ph,
          step: 0,
        };
      } else {
        state.player.x = Math.round(w * 0.2);
        state.player.w = pw;
        state.player.h = ph;
        state.player.groundY = state.groundY - ph;
        if (!state.running || state.waiting) state.player.y = state.player.groundY;
      }
      const cw = 12 * s;
      const ch = 8 * s;
      if (!state.cat) {
        state.cat = {
          x: state.player.x - 18 * s,
          y: state.groundY - ch,
          w: cw,
          h: ch,
          groundY: state.groundY - ch,
          step: 0,
          vy: 0,
        };
      } else {
        state.cat.w = cw;
        state.cat.h = ch;
        state.cat.groundY = state.groundY - ch;
        if (!state.running || state.waiting) {
          state.cat.x = state.player.x - 18 * s;
          state.cat.y = state.cat.groundY;
        }
      }
      if (!state.petals.length) {
        for (let i = 0; i < 18; i++) {
          state.petals.push({
            x: Math.random() * w,
            y: Math.random() * h * 0.7,
            vx: -0.3 - Math.random() * 0.5,
            vy: 0.15 + Math.random() * 0.35,
            r: 1.5 + Math.random() * 2.5,
            a: Math.random() * Math.PI * 2,
            color: Math.random() < 0.5 ? C.petalA : C.petalB,
          });
        }
      }
    }

    function reset() {
      state.dead = false;
      state.waiting = true;
      state.score = 0;
      state.dist = 0;
      state.speed = 4.6;
      state.t = 0;
      state.obstacles = [];
      state.tokens = [];
      state.tokensCollected = 0;
      state.tokensSpawned = 0;
      state.particles = [];
      state.spawnIn = 80;
      state.tokenSpawnIn = 55;
      state.convertLocked = false;
      state.hi = readHi();
      layout();
      state.player.y = state.player.groundY;
      state.player.vy = 0;
      state.cat.y = state.cat.groundY;
      state.cat.vy = 0;
      state.cat.x = state.player.x - 18 * state.scale;
      hud();
      draw();
    }

    function hud() {
      if (state.onHud) {
        state.onHud({
          score: Math.floor(state.score),
          hi: state.hi,
          dead: state.dead,
          waiting: state.waiting,
          tokens: state.tokensCollected,
          source: state.source,
        });
      }
    }

    function jump() {
      if (!state.inputArmed) return;
      /* No mid-jump convert / no auto-restart from Space while dead — CTA card owns restart */
      if (state.dead || state.convertLocked) return;
      if (state.waiting) {
        state.waiting = false;
        state.running = true;
        if (!state.startedOnce) {
          state.startedOnce = true;
          hvTrack("run_start", { source: state.source });
          if (state.onStart) state.onStart({ source: state.source });
        }
      }
      const p = state.player;
      if (p.y >= p.groundY - 1) {
        p.vy = -10.8 - Math.min(2.2, state.speed * 0.12);
      }
    }

    function spawn() {
      const s = state.scale;
      const roll = Math.random();
      let type, w, h, y;
      if (roll < 0.28) {
        type = "404";
        w = (14 + Math.random() * 4) * s;
        h = (16 + Math.random() * 4) * s;
        y = state.groundY - h;
      } else if (roll < 0.48) {
        type = "fence";
        w = 8 * s;
        h = (14 + Math.random() * 4) * s;
        y = state.groundY - h;
      } else if (roll < 0.66) {
        type = "brush";
        w = 10 * s;
        h = 18 * s;
        y = state.groundY - h - (Math.random() < 0.3 ? 10 : 0);
      } else if (roll < 0.84) {
        type = "pumpkin";
        w = (12 + Math.random() * 4) * s;
        h = (10 + Math.random() * 3) * s;
        y = state.groundY - h;
      } else {
        type = "easel";
        w = (14 + Math.random() * 2) * s;
        h = (18 + Math.random() * 3) * s;
        y = state.groundY - h;
      }
      state.obstacles.push({
        type,
        x: state.viewW + 24,
        y,
        w,
        h,
        rot: type === "brush" ? -0.2 - Math.random() * 0.4 : 0,
        spin: type === "brush" ? (Math.random() < 0.5 ? -1 : 1) * 0.05 : 0,
        seed: Math.random() * 1000,
      });
      state.spawnIn = Math.max(48, 100 - state.speed * 4) + Math.random() * 36;
    }

    function spawnToken() {
      if (state.tokensSpawned >= maxTokens) return;
      const s = state.scale;
      const r = 5 * s;
      const high = Math.random() < 0.45;
      state.tokens.push({
        x: state.viewW + 20,
        y: high ? state.groundY - 28 * s : state.groundY - 14 * s,
        r,
        seed: Math.random() * 10,
        kind: Math.random() < 0.5 ? "brush" : "shader",
      });
      state.tokensSpawned += 1;
      state.tokenSpawnIn = 90 + Math.random() * 70;
    }

    function burst(x, y) {
      for (let i = 0; i < 16; i++) {
        state.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 4 - 1,
          life: 18 + Math.random() * 14,
          color: Math.random() < 0.5 ? C.sakura : C.title,
        });
      }
    }

    function die() {
      if (state.dead) return;
      state.dead = true;
      state.running = false;
      state.convertLocked = true;
      const sc = Math.floor(state.score);
      if (sc > state.hi) {
        state.hi = sc;
        writeHi(sc);
      }
      burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2);
      hud();
      hvTrack("run_over", {
        score: sc,
        tokens: state.tokensCollected,
        source: state.source,
      });
      if (sc >= unlockScore && codeStillValid()) {
        writeCodeUnlock({
          code: CFG.code || "HVRUN500",
          score: sc,
          unlockedAt: new Date().toISOString(),
        });
      }
      if (state.onGameOver) {
        state.onGameOver({
          score: sc,
          hi: state.hi,
          tokens: state.tokensCollected,
          source: state.source,
          unlocked: sc >= unlockScore && codeStillValid(),
          tip: pickTip(),
        });
      }
    }

    function aabb(a, b) {
      const pad = 3;
      return (
        a.x + pad < b.x + b.w - pad &&
        a.x + a.w - pad > b.x + pad &&
        a.y + pad < b.y + b.h - pad &&
        a.y + a.h - pad > b.y + pad
      );
    }

    function tick(dt) {
      state.t += dt;
      const p = state.player;
      const cat = state.cat;
      const s = state.scale;

      for (const pet of state.petals) {
        pet.x += pet.vx * dt * 60 - (state.running && !state.waiting ? state.speed * 0.15 * dt * 60 : 0);
        pet.y += pet.vy * dt * 60 + Math.sin(state.t * 2 + pet.a) * 0.15;
        pet.a += dt * 2;
        if (pet.x < -10) {
          pet.x = state.viewW + 10;
          pet.y = Math.random() * state.viewH * 0.65;
        }
        if (pet.y > state.groundY) {
          pet.y = -4;
          pet.x = Math.random() * state.viewW;
        }
      }

      if (!state.waiting && !state.dead) {
        state.speed = Math.min(11.5, 4.6 + state.dist / 2000);
        state.dist += state.speed * dt * 60 * 0.35;
        state.score = state.dist;
        p.step += state.speed * 0.2 * dt * 60;
        p.vy += 0.52 * dt * 60;
        p.y += p.vy * dt * 60;
        if (p.y >= p.groundY) {
          p.y = p.groundY;
          p.vy = 0;
        }
        cat.step += state.speed * 0.22 * dt * 60;
        const targetX = p.x - 16 * s;
        cat.x += (targetX - cat.x) * Math.min(1, 8 * dt);
        if (p.y < p.groundY - 8 * s && cat.y >= cat.groundY - 1) cat.vy = -7.5;
        cat.vy += 0.5 * dt * 60;
        cat.y += cat.vy * dt * 60;
        if (cat.y >= cat.groundY) {
          cat.y = cat.groundY;
          cat.vy = 0;
        }

        state.spawnIn -= dt * 60;
        if (state.spawnIn <= 0) spawn();
        state.tokenSpawnIn -= dt * 60;
        if (state.tokenSpawnIn <= 0) spawnToken();

        for (const o of state.obstacles) {
          o.x -= state.speed * dt * 60;
          if (o.type === "brush") o.rot += o.spin * dt * 60;
        }
        state.obstacles = state.obstacles.filter((o) => o.x + o.w > -40);

        for (const tok of state.tokens) {
          tok.x -= state.speed * dt * 60;
          tok.y += Math.sin(state.t * 4 + tok.seed) * 0.35;
        }
        const hitbox = { x: p.x + 3, y: p.y + 3, w: p.w - 6, h: p.h - 4 };
        const kept = [];
        for (const tok of state.tokens) {
          const box = { x: tok.x - tok.r, y: tok.y - tok.r, w: tok.r * 2, h: tok.r * 2 };
          if (aabb(hitbox, box)) {
            state.tokensCollected = Math.min(maxTokens, state.tokensCollected + 1);
            hvTrack("run_token_collect", {
              tokens: state.tokensCollected,
              kind: tok.kind,
              source: state.source,
            });
            if (state.onToken) state.onToken(state.tokensCollected);
            burst(tok.x, tok.y);
          } else if (tok.x + tok.r > -20) {
            kept.push(tok);
          }
        }
        state.tokens = kept;

        for (const o of state.obstacles) {
          if (aabb(hitbox, o)) {
            die();
            break;
          }
        }
      } else if (state.waiting) {
        p.step += dt * 4;
        cat.step += dt * 4;
      }

      for (const q of state.particles) {
        q.x += q.vx * dt * 60;
        q.y += q.vy * dt * 60;
        q.vy += 0.22 * dt * 60;
        q.life -= dt * 60;
      }
      state.particles = state.particles.filter((q) => q.life > 0);
      hud();
    }

    function drawSky() {
      const w = state.viewW;
      const h = state.viewH;
      const g = ctx.createLinearGradient(0, 0, 0, state.groundY);
      g.addColorStop(0, C.skyTop);
      g.addColorStop(1, C.skyBot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const scroll = state.dist * 0.15;
      drawCloud(ctx, ((80 - scroll * 0.4) % (w + 80)) - 40, 36, 1.1);
      drawCloud(ctx, ((320 - scroll * 0.25) % (w + 100)) - 50, 58, 0.85);
      drawCloud(ctx, ((560 - scroll * 0.35) % (w + 90)) - 45, 28, 1);
    }

    function drawParallax() {
      const w = state.viewW;
      const gy = state.groundY;
      const s = state.scale;
      const far = state.dist * 0.25;
      const mid = state.dist * 0.45;
      ctx.fillStyle = "#9ed96a";
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 20) {
        ctx.lineTo(x, gy - 28 - Math.sin((x + far) * 0.01) * 10);
      }
      ctx.lineTo(w, gy);
      ctx.closePath();
      ctx.fill();
      const cottageX = w * 0.55 - (far % (w + 200)) + w * 0.2;
      drawCottage(ctx, cottageX, gy, s);
      drawSakuraTree(ctx, ((120 - mid) % (w + 160)) - 40, gy, s, false);
      drawSakuraTree(ctx, ((480 - mid * 1.1) % (w + 180)) - 50, gy, s, true);
      drawFruitTree(ctx, ((300 - mid * 0.9) % (w + 140)) - 30, gy, s);
      drawFruitTree(ctx, ((700 - mid * 0.85) % (w + 140)) - 30, gy, s);
    }

    function drawGround() {
      const w = state.viewW;
      const h = state.viewH;
      const gy = state.groundY;
      const scroll = state.dist;
      px(ctx, 0, gy, w, h - gy, C.grassDark);
      px(ctx, 0, gy, w, 10, C.grass);
      px(ctx, 0, gy + 4, w, 4, C.grassLite);
      px(ctx, 0, gy + 10, w, 8, C.path);
      px(ctx, 0, gy + 16, w, 3, C.dirt);
      const step = 14;
      const off = -((scroll) % step);
      for (let x = off; x < w; x += step) {
        px(ctx, x, gy - 3, 2, 3, C.grassLite);
        if ((x / step) % 3 === 0) px(ctx, x + 5, gy + 12, 3, 2, C.dirtDark);
      }
      for (let x = off * 2; x < w; x += 36) {
        px(ctx, x + 8, gy - 2, 2, 2, C.sakura);
        px(ctx, x + 20, gy - 1, 2, 2, C.white);
      }
    }

    function drawTitleOnCanvas() {
      const w = state.viewW;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `bold ${Math.max(18, Math.round(w / 28))}px "Archivo", "Inter Tight", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.titleEdge;
      ctx.fillStyle = C.title;
      const label = "Harshvir Run";
      ctx.strokeText(label, w / 2, 10);
      ctx.fillText(label, w / 2, 10);
      ctx.restore();
    }

    function roundPlaque(x, y, w, h) {
      ctx.fillStyle = C.plaqueDark;
      ctx.beginPath();
      ctx.roundRect(x, y + 2, w, h, 6);
      ctx.fill();
      ctx.fillStyle = C.plaque;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#e8c89088";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 4);
      ctx.stroke();
    }

    function drawPlaques() {
      const sc = Math.floor(state.score).toLocaleString();
      const hi = state.hi.toLocaleString();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      roundPlaque(14, 44, 108, 36);
      ctx.fillStyle = C.plaqueInk;
      ctx.font = `700 9px "Inter Tight", system-ui, sans-serif`;
      ctx.fillText("SCORE", 24, 50);
      ctx.font = `700 14px ui-monospace, Consolas, monospace`;
      ctx.fillText(sc, 24, 62);
      roundPlaque(130, 44, 128, 36);
      ctx.fillStyle = C.plaqueInk;
      ctx.font = `700 9px "Inter Tight", system-ui, sans-serif`;
      ctx.fillText("HIGH SCORE", 140, 50);
      ctx.font = `700 14px ui-monospace, Consolas, monospace`;
      ctx.fillText(hi, 140, 62);
      /* token plaque */
      roundPlaque(268, 44, 92, 36);
      ctx.fillStyle = C.plaqueInk;
      ctx.font = `700 9px "Inter Tight", system-ui, sans-serif`;
      ctx.fillText("ORBS", 278, 50);
      ctx.font = `700 14px ui-monospace, Consolas, monospace`;
      ctx.fillText(state.tokensCollected + "/" + maxTokens, 278, 62);
    }

    function draw() {
      const w = state.viewW;
      const h = state.viewH;
      const s = state.scale;
      drawSky();
      drawParallax();
      drawGround();

      for (const o of state.obstacles) drawObstacle(ctx, o, s);
      for (const tok of state.tokens) drawOrb(ctx, tok, s, state.t);
      drawCat(ctx, state.cat, s);
      drawBoy(ctx, state.player, s);

      for (const pet of state.petals) {
        ctx.save();
        ctx.translate(pet.x, pet.y);
        ctx.rotate(pet.a);
        px(ctx, -pet.r, -pet.r * 0.4, pet.r * 2, pet.r * 0.9, pet.color);
        ctx.restore();
      }
      for (const q of state.particles) px(ctx, q.x, q.y, 3, 3, q.color);

      drawTitleOnCanvas();
      drawPlaques();

      if (state.waiting && !state.dead) {
        const catName = CFG.catName || "Pip";
        ctx.fillStyle = "#3a281088";
        ctx.fillRect(0, h * 0.38, w, 56);
        ctx.textAlign = "center";
        ctx.fillStyle = C.white;
        ctx.font = `600 15px "Inter Tight", system-ui, sans-serif`;
        ctx.fillText("Garden stroll with " + catName + " — don't trip!", w / 2, h * 0.38 + 12);
        ctx.fillStyle = "#fff8";
        ctx.font = `400 12px "Inter Tight", system-ui, sans-serif`;
        ctx.fillText("Space / tap to jump · Collect glowing orbs", w / 2, h * 0.38 + 34);
      }
      /* Dead state: DOM card owns messaging — keep canvas soft dim only */
      if (state.dead) {
        ctx.fillStyle = "#3a281055";
        ctx.fillRect(0, 0, w, h);
      }
    }

    function frame(now) {
      if (!state.last) state.last = now;
      let dt = (now - state.last) / 1000;
      state.last = now;
      dt = clamp(dt, 0, 0.05);
      if (state.running || state.particles.length || state.dead || state.waiting) tick(dt);
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
      if (e && e.target && e.target.closest && e.target.closest("button, a, .hv-run__over, .hv-run__billboard")) return;
      e.preventDefault();
      jump();
    }

    try {
      const Proto = global.CanvasRenderingContext2D && global.CanvasRenderingContext2D.prototype;
      if (Proto && !Proto.roundRect) {
        Proto.roundRect = function (x, y, w, h, r) {
          r = Math.min(r, w / 2, h / 2);
          this.moveTo(x + r, y);
          this.arcTo(x + w, y, x + w, y + h, r);
          this.arcTo(x + w, y + h, x, y + h, r);
          this.arcTo(x, y + h, x, y, r);
          this.arcTo(x, y, x + w, y, r);
          this.closePath();
        };
      }
    } catch (_) {}

    layout();
    reset();
    canvas.addEventListener("pointerdown", onPointer);
    draw();

    return {
      canvas,
      jump,
      reset,
      layout,
      source,
      armInput() {
        state.inputArmed = true;
      },
      start() {
        state.inputArmed = true;
        state.waiting = false;
        state.running = true;
        state.dead = false;
        state.convertLocked = false;
        if (!state.startedOnce) {
          state.startedOnce = true;
          hvTrack("run_start", { source: state.source });
          if (state.onStart) state.onStart({ source: state.source });
        }
        startLoop();
        hud();
      },
      playAgain() {
        reset();
        state.inputArmed = true;
        state.waiting = false;
        state.running = true;
        state.dead = false;
        state.convertLocked = false;
        hvTrack("run_start", { source: state.source, again: true });
        if (state.onStart) state.onStart({ source: state.source, again: true });
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
      getTokens() {
        return state.tokensCollected;
      },
      snapshotDataURL() {
        try {
          return canvas.toDataURL("image/png");
        } catch (_) {
          return "";
        }
      },
    };
  }

  /* ---------- Overlay / page shell ---------- */
  let overlay = null;
  let overlayGame = null;
  let lastFocus = null;
  let sessionDeaths = 0;

  function ensureCss() {
    if (document.querySelector('link[data-hv-run], style[data-hv-run]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/harshvir-run.css?v=5";
    link.setAttribute("data-hv-run", "1");
    document.head.appendChild(link);
  }

  function applyThemeChrome(root) {
    C = buildPalette();
    if (C._overlayBg && root.classList.contains("hv-run--overlay")) {
      root.style.background = C._overlayBg;
    }
    const page = document.body;
    if (page && page.classList.contains("hv-run-404") && C._pageBg) {
      page.style.background = C._pageBg;
    }
    root.setAttribute("data-hv-theme", C._themeId || "default");
  }

  function buildShell(kind) {
    const catName = CFG.catName || "Pip";
    const root = document.createElement("div");
    root.className = "hv-run" + (kind === "overlay" ? " hv-run--overlay" : " hv-run--page");
    root.innerHTML = `
      <div class="hv-run__panel" role="dialog" aria-modal="${kind === "overlay" ? "true" : "false"}" aria-label="Harshvir Run">
        <header class="hv-run__head">
          <div class="hv-run__brand">
            <span class="hv-run__logo" aria-hidden="true"></span>
            <div>
              <strong>Harshvir Run</strong>
              <p>A cozy garden dash with ${catName}.</p>
            </div>
          </div>
          <div class="hv-run__scores">
            <span class="hv-run__score"><b data-hv-score>0</b><small>SCORE</small></span>
            <span class="hv-run__hi"><b data-hv-hi>0</b><small>HIGH SCORE</small></span>
            <span class="hv-run__orbs"><b data-hv-orbs>0/5</b><small>ORBS</small></span>
          </div>
          ${kind === "overlay" ? '<button type="button" class="hv-run__close" aria-label="Close">Close</button>' : ""}
        </header>
        <div class="hv-run__stage">
          <canvas class="hv-run__canvas" width="720" height="320" aria-label="Harshvir Run game"></canvas>
          <div class="hv-run__calm" hidden>
            <p>Motion is reduced on this device.</p>
            <button type="button" class="hv-run__play">Play Harshvir Run</button>
          </div>
          <div class="hv-run__billboard" data-hv-billboard hidden>
            <a class="hv-run__billboard-link" data-hv-billboard-link href="page.html?s=contact">
              <strong data-hv-billboard-label>1:1 slots open</strong>
              <span data-hv-billboard-sub>Mentorship with Harshvir — say hi</span>
            </a>
            <button type="button" class="hv-run__billboard-x" data-hv-billboard-x aria-label="Dismiss">×</button>
          </div>
          <div class="hv-run__over" data-hv-over hidden>
            <div class="hv-run__over-card">
              <p class="hv-run__over-kicker">Bonk!</p>
              <h3 class="hv-run__over-title">Nice run</h3>
              <p class="hv-run__over-score"><span data-hv-over-score>0</span> pts · with ${catName}</p>
              <p class="hv-run__over-tip" data-hv-tip></p>
              <p class="hv-run__over-tokens" data-hv-tokens></p>
              <div class="hv-run__perk" data-hv-perk hidden>
                <p class="hv-run__perk-label">Score unlock</p>
                <code class="hv-run__perk-code" data-hv-code></code>
                <button type="button" class="hv-run__perk-copy" data-hv-code-copy>Copy code</button>
                <p class="hv-run__perk-note" data-hv-code-note></p>
              </div>
              <div class="hv-run__over-actions">
                <a class="hv-run__cta-primary" data-hv-cta-primary href="#">Book a 1:1</a>
                <button type="button" class="hv-run__again" data-hv-again>Play again</button>
              </div>
              <div class="hv-run__over-links">
                <a class="hv-run__cta-secondary" data-hv-cta-secondary href="#">Browse Asset Bay</a>
                <a class="hv-run__cta-tertiary" data-hv-cta-tertiary hidden href="#">See classes</a>
                <a class="hv-run__cta-tip" data-hv-cta-tip hidden href="tips/run-tip.html">Free timing tip</a>
              </div>
              <div class="hv-run__over-share">
                <button type="button" class="hv-run__share" data-hv-share>Share my run</button>
                <button type="button" class="hv-run__snap" data-hv-snap>Save frame</button>
              </div>
            </div>
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

  function wireHud(root) {
    const scoreEl = root.querySelector("[data-hv-score]");
    const hiEl = root.querySelector("[data-hv-hi]");
    const orbsEl = root.querySelector("[data-hv-orbs]");
    const maxT = Math.max(1, (CFG.maxTokensPerRun | 0) || 5);
    return function onHud(h) {
      if (scoreEl) scoreEl.textContent = h.score.toLocaleString();
      if (hiEl) hiEl.textContent = h.hi.toLocaleString();
      if (orbsEl) orbsEl.textContent = (h.tokens || 0) + "/" + maxT;
    };
  }

  function hideOver(root) {
    const over = root.querySelector("[data-hv-over]");
    if (over) over.hidden = true;
  }

  function showBillboard(root, source) {
    if (sessionDeaths < 1) return;
    const board = root.querySelector("[data-hv-billboard]");
    if (!board || board.dataset.dismissed === "1") return;
    const bb = CFG.billboard || {};
    const link = root.querySelector("[data-hv-billboard-link]");
    const label = root.querySelector("[data-hv-billboard-label]");
    const sub = root.querySelector("[data-hv-billboard-sub]");
    if (link) link.href = bb.href || "page.html?s=contact";
    if (label) label.textContent = bb.label || "1:1 slots open";
    if (sub) sub.textContent = bb.sub || "Mentorship with Harshvir — say hi";
    board.hidden = false;
    if (link && !link.dataset.wired) {
      link.dataset.wired = "1";
      link.addEventListener("click", () => {
        hvTrack("run_cta_click", { cta_id: "billboard_1on1", source });
      });
    }
    const x = root.querySelector("[data-hv-billboard-x]");
    if (x && !x.dataset.wired) {
      x.dataset.wired = "1";
      x.addEventListener("click", () => {
        board.hidden = true;
        board.dataset.dismissed = "1";
      });
    }
  }

  function fillOverCard(root, game, info) {
    const over = root.querySelector("[data-hv-over]");
    if (!over) return;
    const source = info.source || "secret";
    const ctas = ctaSet(source);
    const primary = ctas.primary || {};
    const secondary = ctas.secondary || {};
    const tertiary = ctas.tertiary || null;
    const maxT = Math.max(1, (CFG.maxTokensPerRun | 0) || 5);
    const tipMin = Math.max(1, (CFG.tipMinTokens | 0) || 3);

    const scoreEl = root.querySelector("[data-hv-over-score]");
    if (scoreEl) scoreEl.textContent = info.score.toLocaleString();
    const tipEl = root.querySelector("[data-hv-tip]");
    if (tipEl) tipEl.textContent = info.tip || pickTip();
    const tokEl = root.querySelector("[data-hv-tokens]");
    if (tokEl) {
      tokEl.textContent =
        "You found " +
        info.tokens +
        "/" +
        maxT +
        " orbs" +
        (info.tokens >= tipMin ? " — claim a free timing tip." : " — grab 3+ for a free tip.");
    }

    const p = root.querySelector("[data-hv-cta-primary]");
    if (p) {
      p.textContent = primary.label || "Continue";
      p.href = primary.href || "page.html?s=classes";
      p.dataset.ctaId = primary.id || "primary";
    }
    const s = root.querySelector("[data-hv-cta-secondary]");
    if (s) {
      s.textContent = secondary.label || "Browse Asset Bay";
      s.href = secondary.href || "page.html?s=shop";
      s.dataset.ctaId = secondary.id || "secondary";
    }
    const t = root.querySelector("[data-hv-cta-tertiary]");
    if (t) {
      if (tertiary) {
        t.hidden = false;
        t.textContent = tertiary.label || "See classes";
        t.href = tertiary.href || "page.html?s=classes";
        t.dataset.ctaId = tertiary.id || "tertiary";
      } else {
        t.hidden = true;
      }
    }

    const tipLink = root.querySelector("[data-hv-cta-tip]");
    if (tipLink) {
      if (info.tokens >= tipMin) {
        tipLink.hidden = false;
        tipLink.href = CFG.tipUrl || "tips/run-tip.html";
      } else {
        tipLink.hidden = true;
      }
    }

    /* Score → ticket */
    const perk = root.querySelector("[data-hv-perk]");
    const stored = readCodeUnlock();
    const showCode =
      codeStillValid() &&
      ((info.unlocked && CFG.code) || (stored && stored.code));
    if (perk) {
      if (showCode) {
        perk.hidden = false;
        const code = (stored && stored.code) || CFG.code || "HVRUN500";
        const codeEl = root.querySelector("[data-hv-code]");
        if (codeEl) codeEl.textContent = code;
        const note = root.querySelector("[data-hv-code-note]");
        if (note) {
          let msg = CFG.codeNote || "";
          if (CFG.codeExpiresISO) msg += " Expires " + CFG.codeExpiresISO + ".";
          note.textContent = msg;
        }
      } else {
        perk.hidden = true;
      }
    }

    over.hidden = false;
    sessionDeaths += 1;
    /* Billboard only after the first death in this session (so: show starting at 2nd death UI pass).
       Spec: "After first game-over in a session" — meaning once they've died once, then show it.
       Interpreting as: show on/after the first death (available after they've experienced game-over).
       "Not on first spawn" — so appear when game-over card shows the first time is OK,
       but "after first death" means starting from the second visit to game-over.
       Spec: "After first game-over in a session, show clickable garden billboard"
       → after the first game-over has happened, show billboard. So on the first game-over itself we can show it
       at the end, OR show it when they play again. Clearest: show billboard when sessionDeaths >= 1 (i.e. now).
       "Not on first spawn" is satisfied. I'll show when sessionDeaths >= 1 after increment, i.e. first death onwards. */
    showBillboard(root, source);

    /* Wire one-shot listeners via delegation flag */
    if (!root.dataset.overWired) {
      root.dataset.overWired = "1";
      root.addEventListener("click", (e) => {
        const again = e.target.closest("[data-hv-again]");
        if (again && game) {
          hideOver(root);
          const board = root.querySelector("[data-hv-billboard]");
          /* keep billboard visible after first death while playing again */
          game.playAgain();
          return;
        }
        const copyBtn = e.target.closest("[data-hv-code-copy]");
        if (copyBtn) {
          const codeEl = root.querySelector("[data-hv-code]");
          const code = (codeEl && codeEl.textContent) || CFG.code || "";
          const done = () => {
            copyBtn.textContent = "Copied ✓";
            setTimeout(() => {
              copyBtn.textContent = "Copy code";
            }, 1600);
          };
          hvTrack("run_code_copy", { source: game.source, code });
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done, done);
          } else done();
          return;
        }
        const shareBtn = e.target.closest("[data-hv-share]");
        if (shareBtn) {
          doShare(game);
          return;
        }
        const snapBtn = e.target.closest("[data-hv-snap]");
        if (snapBtn) {
          doSnap(game);
          return;
        }
        const cta = e.target.closest("[data-hv-cta-primary], [data-hv-cta-secondary], [data-hv-cta-tertiary], [data-hv-cta-tip]");
        if (cta) {
          hvTrack("run_cta_click", {
            cta_id: cta.dataset.ctaId || (cta.hasAttribute("data-hv-cta-tip") ? "tip" : "cta"),
            source: game.source,
          });
        }
      });
    }
  }

  function shareText(score) {
    const challenge = (CFG.challengeScore | 0) || 1200;
    const url = CFG.siteUrl || "https://harshvirverse.com/";
    return (
      "I scored " +
      score +
      " in Harshvir Run — cozy garden dash with Pip. Beat Harshvir: " +
      challenge +
      " " +
      url
    );
  }

  function doShare(game) {
    const score = game ? game.getScore() : 0;
    const text = shareText(score);
    const url = CFG.siteUrl || "https://harshvirverse.com/";
    hvTrack("run_share", { score, source: game && game.source });
    if (navigator.share) {
      navigator.share({ title: "Harshvir Run", text, url }).catch(() => openXIntent(text));
    } else {
      openXIntent(text);
    }
  }

  function openXIntent(text) {
    const href = "https://x.com/intent/post?text=" + encodeURIComponent(text);
    window.open(href, "_blank", "noopener");
  }

  function doSnap(game) {
    if (!game || !game.snapshotDataURL) return;
    const data = game.snapshotDataURL();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = "harshvir-run-" + game.getScore() + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  function onResizeOverlay() {
    if (overlayGame) layoutSafe(overlayGame);
  }

  function layoutSafe(game) {
    try {
      game.layout();
    } catch (_) {}
  }

  function attachGameUI(root, game, source) {
    applyThemeChrome(root);
    game._source = source;
    /* wrap: when createGame already has onGameOver from opts — we pass it at create time */
  }

  function openOverlay() {
    ensureCss();
    if (overlay) closeOverlay();
    lastFocus = document.activeElement;
    overlay = buildShell("overlay");
    document.body.appendChild(overlay);
    document.body.classList.add("hv-run-open");
    const canvas = overlay.querySelector("canvas");
    const calm = overlay.querySelector(".hv-run__calm");
    const playBtn = overlay.querySelector(".hv-run__play");
    const reduced = prefersReduce();
    const source = "secret";
    overlayGame = createGame(canvas, {
      onHud: wireHud(overlay),
      reduced,
      source,
      onGameOver(info) {
        fillOverCard(overlay, overlayGame, info);
      },
    });
    attachGameUI(overlay, overlayGame, source);
    overlayGame.bindKeys();
    overlayGame.ready();
    hvTrack("run_unlock", { source: "secret" });
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
    overlay.querySelectorAll(".hv-run__close, [data-hv-close]").forEach((btn) => btn.addEventListener("click", closeOverlay));
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

  function mountInline(container, opts) {
    opts = opts || {};
    ensureCss();
    const root = buildShell("page");
    container.appendChild(root);
    const canvas = root.querySelector("canvas");
    const calm = root.querySelector(".hv-run__calm");
    const playBtn = root.querySelector(".hv-run__play");
    const reduced = prefersReduce() || !!opts.forceCalm;
    const source = opts.source || "404";
    let game = null;
    game = createGame(canvas, {
      onHud: wireHud(root),
      reduced,
      source,
      onGameOver(info) {
        fillOverCard(root, game, info);
      },
    });
    attachGameUI(root, game, source);
    game.bindKeys();
    game.ready();
    hvTrack("run_unlock", { source });
    if (reduced) {
      calm.hidden = false;
      playBtn.addEventListener("click", () => {
        calm.hidden = true;
        game.armInput();
        game.start();
      });
    } else {
      calm.hidden = true;
    }
    global.addEventListener("resize", () => layoutSafe(game));
    requestAnimationFrame(() => layoutSafe(game));
    return game;
  }

  function initHomeUnlock() {
    ensureCss();
    let clicks = 0;
    let timer = 0;
    const RESET_MS = 2000;
    const NEED = 5;
    function onBrandClick(e) {
      const b = e.target.closest && e.target.closest(".brand b");
      if (!b) return;
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
    document.addEventListener("click", onBrandClick, true);
  }


  /* Debug/preview: ?hvrun=over&source=secret|404&score=600&tokens=3 forces game-over card */
  function maybePreviewOver() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("hvrun") !== "over") return false;
      const source = q.get("source") === "404" ? "404" : "secret";
      const score = Math.max(0, parseInt(q.get("score") || "600", 10) || 600);
      const tokens = Math.max(0, parseInt(q.get("tokens") || "3", 10) || 3);
      ensureCss();
      const kind = document.body && document.body.classList.contains("hv-run-404") ? "page" : "overlay";
      let root;
      if (kind === "overlay") {
        if (overlay) closeOverlay();
        overlay = buildShell("overlay");
        document.body.appendChild(overlay);
        document.body.classList.add("hv-run-open");
        root = overlay;
      } else {
        const mount = document.getElementById("hv-run-root") || document.body;
        root = buildShell("page");
        mount.appendChild(root);
      }
      applyThemeChrome(root);
      const canvas = root.querySelector("canvas");
      const game = createGame(canvas, {
        onHud: wireHud(root),
        reduced: false,
        source,
        onGameOver() {},
      });
      game.ready();
      /* force score for perk */
      const unlock = Math.max(1, (CFG.unlockScore | 0) || 500);
      if (score >= unlock && codeStillValid()) {
        writeCodeUnlock({ code: CFG.code || "HVRUN500", score, unlockedAt: new Date().toISOString() });
      }
      sessionDeaths = 1;
      fillOverCard(root, game, {
        score,
        hi: Math.max(score, readHi()),
        tokens,
        source,
        unlocked: score >= unlock && codeStillValid(),
        tip: pickTip(),
      });
      return true;
    } catch (err) {
      console.warn("hvrun preview", err);
      return false;
    }
  }

  function boot() {
    if (maybePreviewOver()) return;
    if (document.body && document.body.classList.contains("home")) initHomeUnlock();
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
    CODE_KEY,
    config: CFG,
  };
})(window);
