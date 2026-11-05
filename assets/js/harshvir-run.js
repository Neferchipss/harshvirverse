/* Harshvir Run — cozy HD pixel endless runner (secret unlock + 404). Canvas 2D. */
(function (global) {
  "use strict";

  const HI_KEY = "hv_run_hi";

  /* Cozy Stardew-like palette */
  const C = {
    skyTop: "#7ec8f5",
    skyBot: "#c8e8ff",
    cloud: "#ffffff",
    cloudShade: "#e8f4ff",
    grass: "#6bcb3a",
    grassDark: "#4fa82a",
    grassLite: "#8fe05a",
    dirt: "#c4a06a",
    dirtDark: "#9a7848",
    path: "#d4b888",
    wood: "#8b5a2b",
    woodLite: "#b87840",
    woodDark: "#5c3a18",
    thatch: "#a67c3a",
    thatchDark: "#7a5528",
    sakura: "#f7b6c8",
    sakuraDeep: "#e8899e",
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
    title: "#f5d04a",
    titleEdge: "#5a3a10",
    plaque: "#c9a06a",
    plaqueDark: "#8b6238",
    plaqueInk: "#3a2810",
    white: "#fffef8",
    pumpkin: "#e87820",
    pumpkinDark: "#c45810",
    stem: "#4a7a28",
  };

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

  /* ---------- Sprites (procedural pixel) ---------- */
  function drawBoy(ctx, p, s) {
    const x = p.x;
    const y = p.y;
    const jumping = p.vy < -0.4 || p.y + p.h < p.groundY - 2;
    const gait = Math.sin(p.step) > 0;
    // soft shadow
    ellipse(ctx, x + p.w / 2, p.groundY + p.h + 2, p.w * 0.45, 3, "#00000022");
    // legs / shorts
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
    // torso teal shirt
    px(ctx, x + 3 * s, y + 7 * s, 8 * s, 6 * s, C.shirt);
    px(ctx, x + 3 * s, y + 7 * s, 8 * s, 1 * s, C.shirtLite);
    px(ctx, x + 2 * s, y + 8 * s, 1 * s, 4 * s, C.shirt); // arm
    px(ctx, x + 11 * s, y + 8 * s, 1 * s, 4 * s, C.shirt);
    // head
    px(ctx, x + 4 * s, y + 3 * s, 6 * s, 5 * s, C.skin);
    px(ctx, x + 4 * s, y + 6 * s, 6 * s, 1 * s, C.skinShade);
    // messy dark hair
    px(ctx, x + 3 * s, y + 1 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 5 * s, y + 0 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 7 * s, y + 1 * s, 2 * s, 3 * s, C.hair);
    px(ctx, x + 9 * s, y + 2 * s, 2 * s, 2 * s, C.hair);
    px(ctx, x + 4 * s, y + 3 * s, 6 * s, 1 * s, C.hair);
    // eyes + smile
    px(ctx, x + 5 * s, y + 5 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 8 * s, y + 5 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 6 * s, y + 6 * s, 2 * s, 1 * s, C.skinShade);
  }

  function drawCat(ctx, cat, s) {
    const x = cat.x;
    const y = cat.y;
    const gait = Math.sin(cat.step) > 0;
    ellipse(ctx, x + 5 * s, cat.groundY + 2, 5 * s, 2, "#00000018");
    // body
    px(ctx, x + 2 * s, y + 3 * s, 8 * s, 4 * s, C.catOrange);
    px(ctx, x + 3 * s, y + 4 * s, 5 * s, 2 * s, C.catLite);
    // head
    px(ctx, x + 7 * s, y + 1 * s, 5 * s, 4 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 2 * s, 3 * s, 2 * s, C.catLite);
    // ears
    px(ctx, x + 7 * s, y + 0 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 10 * s, y + 0 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 1 * s, 1 * s, 1 * s, C.catNose);
    // face
    px(ctx, x + 8 * s, y + 2 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 10 * s, y + 2 * s, 1 * s, 1 * s, C.hair);
    px(ctx, x + 9 * s, y + 3 * s, 1 * s, 1 * s, C.catNose);
    // white chest
    px(ctx, x + 4 * s, y + 5 * s, 3 * s, 2 * s, C.catWhite);
    // legs
    const a = gait ? 2 : 3;
    const b = gait ? 6 : 5;
    px(ctx, x + a * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + b * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 8 * s, y + 6 * s, 2 * s, 2 * s, C.catOrange);
    // tail curl
    px(ctx, x + 0 * s, y + 2 * s, 2 * s, 2 * s, C.catOrange);
    px(ctx, x + 0 * s, y + 1 * s, 1 * s, 2 * s, C.catLite);
  }

  function drawObstacle(ctx, o, s, t) {
    if (o.type === "404") drawStone404(ctx, o, s);
    else if (o.type === "fence") drawFence(ctx, o, s);
    else if (o.type === "brush") drawBrush(ctx, o, s);
    else if (o.type === "pumpkin") drawPumpkin(ctx, o, s);
    else if (o.type === "easel") drawEasel(ctx, o, s);
  }

  function drawStone404(ctx, o, s) {
    const x = o.x;
    const y = o.y;
    // mossy tablet
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
    // post
    px(ctx, x + 2 * s, y + 2 * s, 3 * s, o.h - 2 * s, C.wood);
    px(ctx, x + 2 * s, y + 2 * s, 1 * s, o.h - 2 * s, C.woodLite);
    // star carved top
    px(ctx, x + 1 * s, y, 5 * s, 3 * s, C.woodDark);
    px(ctx, x + 3 * s, y + 1 * s, 1 * s, 1 * s, C.title);
    // rail hint
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
    // legs
    px(ctx, x + 1 * s, y + 6 * s, 2 * s, o.h - 6 * s, C.woodDark);
    px(ctx, x + o.w - 3 * s, y + 6 * s, 2 * s, o.h - 6 * s, C.woodDark);
    px(ctx, x + o.w / 2 - s, y + 8 * s, 2 * s, o.h - 8 * s, C.wood);
    // canvas board
    px(ctx, x + 1 * s, y + 1 * s, o.w - 2 * s, 10 * s, C.white);
    px(ctx, x + 1 * s, y + 1 * s, o.w - 2 * s, 1 * s, C.wood);
    px(ctx, x + 1 * s, y + 10 * s, o.w - 2 * s, 1 * s, C.wood);
    // tiny painting hint
    px(ctx, x + 3 * s, y + 3 * s, 4 * s, 3 * s, C.skyTop);
    px(ctx, x + 3 * s, y + 5 * s, 5 * s, 3 * s, C.grass);
    px(ctx, x + 7 * s, y + 4 * s, 2 * s, 2 * s, C.sakura);
  }

  function drawCottage(ctx, x, gy, scale, scroll) {
    const s = scale * 0.55;
    const baseY = gy - 38 * s;
    // wall
    px(ctx, x, baseY + 12 * s, 42 * s, 26 * s, "#e8d2a8");
    px(ctx, x + 2 * s, baseY + 14 * s, 38 * s, 22 * s, "#f0e0b8");
    // thatch roof
    px(ctx, x - 4 * s, baseY + 4 * s, 50 * s, 12 * s, C.thatch);
    px(ctx, x - 2 * s, baseY + 2 * s, 46 * s, 4 * s, C.thatchDark);
    px(ctx, x + 6 * s, baseY, 30 * s, 4 * s, C.thatch);
    // chimney
    px(ctx, x + 32 * s, baseY - 2 * s, 6 * s, 10 * s, C.stone);
    px(ctx, x + 31 * s, baseY - 3 * s, 8 * s, 2 * s, C.stoneDark);
    // door + window
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
    // canopy blobs
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
    const ctx = canvas.getContext("2d");
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
      petals: [],
      particles: [],
      spawnIn: 90,
      raf: 0,
      last: 0,
      onHud: typeof opts.onHud === "function" ? opts.onHud : null,
      reduced: !!opts.reduced,
      inputArmed: !opts.reduced,
      viewW: 720,
      viewH: 300,
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
            color: Math.random() < 0.5 ? C.sakura : C.sakuraDeep,
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
      state.particles = [];
      state.spawnIn = 80;
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
      const sc = Math.floor(state.score);
      if (sc > state.hi) {
        state.hi = sc;
        writeHi(sc);
      }
      burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2);
      hud();
    }

    function aabb(a, b) {
      const pad = 3;
      return a.x + pad < b.x + b.w - pad && a.x + a.w - pad > b.x + pad && a.y + pad < b.y + b.h - pad && a.y + a.h - pad > b.y + pad;
    }

    function tick(dt) {
      state.t += dt;
      const p = state.player;
      const cat = state.cat;
      const s = state.scale;

      // petals always drift gently
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
        // cat follows with slight lag + hop when player jumps high
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
        for (const o of state.obstacles) {
          o.x -= state.speed * dt * 60;
          if (o.type === "brush") o.rot += o.spin * dt * 60;
        }
        state.obstacles = state.obstacles.filter((o) => o.x + o.w > -40);
        const hitbox = { x: p.x + 3, y: p.y + 3, w: p.w - 6, h: p.h - 4 };
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
      // distant hills
      ctx.fillStyle = "#9ed96a";
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 20) {
        ctx.lineTo(x, gy - 28 - Math.sin((x + far) * 0.01) * 10);
      }
      ctx.lineTo(w, gy);
      ctx.closePath();
      ctx.fill();

      // cottage + trees looping
      const cottageX = w * 0.55 - (far % (w + 200)) + w * 0.2;
      drawCottage(ctx, cottageX, gy, s, far);
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
      // grass band
      px(ctx, 0, gy, w, h - gy, C.grassDark);
      px(ctx, 0, gy, w, 10, C.grass);
      px(ctx, 0, gy + 4, w, 4, C.grassLite);
      // dirt path strip
      px(ctx, 0, gy + 10, w, 8, C.path);
      px(ctx, 0, gy + 16, w, 3, C.dirt);
      // tufts
      const step = 14;
      const off = -((scroll) % step);
      for (let x = off; x < w; x += step) {
        px(ctx, x, gy - 3, 2, 3, C.grassLite);
        if ((x / step) % 3 === 0) px(ctx, x + 5, gy + 12, 3, 2, C.dirtDark);
      }
      // flowers
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

    function drawPlaques() {
      // wooden score plaques drawn on canvas as backup; DOM HUD is primary
      const sc = Math.floor(state.score).toLocaleString();
      const hi = state.hi.toLocaleString();
      ctx.font = `600 11px "Inter Tight", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      // SCORE plaque
      roundPlaque(14, 44, 108, 36);
      ctx.fillStyle = C.plaqueInk;
      ctx.font = `700 9px "Inter Tight", system-ui, sans-serif`;
      ctx.fillText("SCORE", 24, 50);
      ctx.font = `700 14px ui-monospace, Consolas, monospace`;
      ctx.fillText(sc, 24, 62);
      // HI plaque
      roundPlaque(130, 44, 128, 36);
      ctx.fillStyle = C.plaqueInk;
      ctx.font = `700 9px "Inter Tight", system-ui, sans-serif`;
      ctx.fillText("HIGH SCORE", 140, 50);
      ctx.font = `700 14px ui-monospace, Consolas, monospace`;
      ctx.fillText(hi, 140, 62);
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
      // carved edge
      ctx.strokeStyle = "#e8c89088";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 4);
      ctx.stroke();
    }

    function draw() {
      const w = state.viewW;
      const h = state.viewH;
      const s = state.scale;
      drawSky();
      drawParallax();
      drawGround();

      for (const o of state.obstacles) drawObstacle(ctx, o, s, state.t);
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
        ctx.fillStyle = "#3a281088";
        ctx.fillRect(0, h * 0.38, w, 56);
        ctx.textAlign = "center";
        ctx.fillStyle = C.white;
        ctx.font = `600 15px "Inter Tight", system-ui, sans-serif`;
        ctx.fillText("Garden stroll — don't trip!", w / 2, h * 0.38 + 12);
        ctx.fillStyle = "#fff8";
        ctx.font = `400 12px "Inter Tight", system-ui, sans-serif`;
        ctx.fillText("Space / tap to jump · Run with your cat", w / 2, h * 0.38 + 34);
      }
      if (state.dead) {
        ctx.fillStyle = "#3a281099";
        ctx.fillRect(0, h * 0.34, w, 68);
        ctx.textAlign = "center";
        ctx.fillStyle = C.title;
        ctx.font = `700 18px "Archivo", system-ui, sans-serif`;
        ctx.strokeStyle = C.titleEdge;
        ctx.lineWidth = 3;
        ctx.strokeText("Bonk!", w / 2, h * 0.34 + 14);
        ctx.fillText("Bonk!", w / 2, h * 0.34 + 14);
        ctx.fillStyle = C.white;
        ctx.font = `400 13px "Inter Tight", system-ui, sans-serif`;
        ctx.fillText("Score " + Math.floor(state.score).toLocaleString() + " · Space / tap to try again", w / 2, h * 0.34 + 42);
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
      if (e && e.target && e.target.closest && e.target.closest("button, a")) return;
      e.preventDefault();
      jump();
    }

    // roundRect polyfill
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
      };
    }

    layout();
    reset();
    canvas.addEventListener("pointerdown", onPointer);
    draw();

    return {
      canvas,
      jump,
      reset,
      layout,
      armInput() {
        state.inputArmed = true;
      },
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

  /* ---------- Overlay / page shell ---------- */
  let overlay = null;
  let overlayGame = null;
  let lastFocus = null;

  function ensureCss() {
    if (document.querySelector('link[data-hv-run], style[data-hv-run]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/harshvir-run.css?v=4";
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
              <p>A cozy garden dash with your cat.</p>
            </div>
          </div>
          <div class="hv-run__scores">
            <span class="hv-run__score"><b data-hv-score>0</b><small>SCORE</small></span>
            <span class="hv-run__hi"><b data-hv-hi>0</b><small>HIGH SCORE</small></span>
          </div>
          ${kind === "overlay" ? '<button type="button" class="hv-run__close" aria-label="Close">Close</button>' : ""}
        </header>
        <div class="hv-run__stage">
          <canvas class="hv-run__canvas" width="720" height="320" aria-label="Harshvir Run game"></canvas>
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

  function wireHud(root) {
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

  function onResizeOverlay() {
    if (overlayGame) layoutSafe(overlayGame);
  }

  function layoutSafe(game) {
    try {
      game.layout();
    } catch (_) {}
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
    overlayGame = createGame(canvas, { onHud: wireHud(overlay), reduced });
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
    const game = createGame(canvas, { onHud: wireHud(root), reduced });
    game.bindKeys();
    game.ready();
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

  function boot() {
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
  };
})(window);
