/*! harshvirverse private first-party analytics (cookie-free).
   Pageviews, engagement, heatmaps, compact session replay.
   DEMO mode (empty ENDPOINT) stores in this browser only.
   Privacy: never records keystrokes or form field values. */
(function () {
  "use strict";
  const cfg = window.HV_ANALYTICS || {};
  const ENDPOINT = (cfg.ENDPOINT || "").replace(/\/$/, "");
  const DEMO = !ENDPOINT;
  const STORE_KEY = "hv_analytics_demo_v2";
  const REPLAY_STORE_KEY = "hv_analytics_replay_v1";
  const VID_KEY = "hv_vid";
  const VID_SEEN = "hv_vid_seen";
  const SID_KEY = "hv_sid";
  const SID_TS = "hv_sid_ts";
  const LANDING_KEY = "hv_landing";
  const PATH_KEY = "hv_spath";

  const REPLAY_MOUSE_MS = 120;
  const REPLAY_FLUSH_MS = 4000;
  const REPLAY_MAX_EVENTS = 1800;
  const REPLAY_MAX_BATCH = 80;
  const HEAT_THROTTLE_MS = 40;

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  let isNewVisitor = false;
  function getVid() {
    try {
      let v = localStorage.getItem(VID_KEY);
      if (!v) {
        v = uuid();
        localStorage.setItem(VID_KEY, v);
        isNewVisitor = true;
        localStorage.setItem(VID_SEEN, "1");
      } else if (!localStorage.getItem(VID_SEEN)) {
        // Existing vid from older tracker = returning
        localStorage.setItem(VID_SEEN, "1");
        isNewVisitor = false;
      }
      return v;
    } catch {
      isNewVisitor = true;
      return uuid();
    }
  }

  function getSid() {
    try {
      const now = Date.now();
      let sid = sessionStorage.getItem(SID_KEY);
      const ts = Number(sessionStorage.getItem(SID_TS) || 0);
      if (!sid || now - ts > 30 * 60 * 1000) {
        sid = uuid();
        sessionStorage.setItem(SID_KEY, sid);
        sessionStorage.removeItem(LANDING_KEY);
        sessionStorage.removeItem(PATH_KEY);
      }
      sessionStorage.setItem(SID_TS, String(now));
      return sid;
    } catch {
      return uuid();
    }
  }

  function touchSid() {
    try { sessionStorage.setItem(SID_TS, String(Date.now())); } catch {}
  }

  function device() {
    const ua = navigator.userAgent || "";
    if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
    if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "phone";
    return "desktop";
  }

  function screenBand() {
    const w = window.innerWidth || 0;
    if (w < 600) return "xs";
    if (w < 900) return "sm";
    if (w < 1200) return "md";
    if (w < 1600) return "lg";
    return "xl";
  }

  function sectionFromUrl() {
    try {
      const s = new URLSearchParams(location.search).get("s");
      if (s) return s;
      if (document.body && document.body.dataset && document.body.dataset.section) {
        return document.body.dataset.section;
      }
      return location.pathname.endsWith("index.html") || /\/$/.test(location.pathname) ? "home" : null;
    } catch {
      return null;
    }
  }

  function pagePath() {
    return (location.pathname + location.search).slice(0, 300) || "/";
  }

  function utmSource() {
    try { return new URLSearchParams(location.search).get("utm_source") || ""; } catch { return ""; }
  }

  function getPathArr() {
    try {
      const raw = sessionStorage.getItem(PATH_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function pushPath(label) {
    try {
      const arr = getPathArr();
      if (arr.length && arr[arr.length - 1] === label) return arr;
      arr.push(String(label).slice(0, 80));
      while (arr.length > 40) arr.shift();
      sessionStorage.setItem(PATH_KEY, JSON.stringify(arr));
      return arr;
    } catch { return []; }
  }

  function getLanding() {
    try {
      let L = sessionStorage.getItem(LANDING_KEY);
      if (!L) {
        L = pagePath();
        sessionStorage.setItem(LANDING_KEY, L);
      }
      return L;
    } catch { return pagePath(); }
  }

  function buildEvent(type, meta) {
    touchSid();
    return {
      type: type || "pageview",
      path: pagePath(),
      section: sectionFromUrl(),
      hash: (location.hash || "").slice(0, 120),
      ref: document.referrer ? document.referrer.slice(0, 500) : "",
      utm_source: utmSource(),
      device: device(),
      lang: (navigator.language || "").slice(0, 32),
      screen: screenBand(),
      vw: Math.min(4000, window.innerWidth | 0),
      vh: Math.min(4000, window.innerHeight | 0),
      vid: getVid(),
      sid: getSid(),
      is_new: isNewVisitor,
      meta: meta || {},
      t: new Date().toISOString(),
    };
  }

  function demoPush(evt) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push(evt);
      while (list.length > 2500) list.shift();
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch { /* quota */ }
  }

  function demoReplayUpsert(sid, patch) {
    try {
      const raw = localStorage.getItem(REPLAY_STORE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const cur = map[sid] || { sid, events: [], start: Date.now(), meta: {} };
      if (patch.events && patch.events.length) {
        cur.events = (cur.events || []).concat(patch.events);
        if (cur.events.length > REPLAY_MAX_EVENTS) cur.events = cur.events.slice(-REPLAY_MAX_EVENTS);
      }
      if (patch.meta) cur.meta = Object.assign(cur.meta || {}, patch.meta);
      if (patch.vid) cur.vid = patch.vid;
      if (patch.start) cur.start = patch.start;
      map[sid] = cur;
      // Keep only last 12 sessions in demo
      const keys = Object.keys(map);
      if (keys.length > 12) {
        keys.sort((a, b) => (map[a].start || 0) - (map[b].start || 0));
        keys.slice(0, keys.length - 12).forEach((k) => delete map[k]);
      }
      localStorage.setItem(REPLAY_STORE_KEY, JSON.stringify(map));
    } catch { /* quota */ }
  }

  function send(evt) {
    if (DEMO) {
      if (evt.type === "replay_batch") {
        demoReplayUpsert(evt.sid, {
          events: (evt.meta && evt.meta.events) || [],
          vid: evt.vid,
          start: evt.meta && evt.meta.start,
          meta: {
            path: evt.path,
            device: evt.device,
            screen: evt.screen,
            lang: evt.lang,
            vw: evt.vw,
            vh: evt.vh,
          },
        });
        // Also push a light marker into the event stream for session lists
        const marker = Object.assign({}, evt, { type: "replay_meta", meta: { n: (evt.meta && evt.meta.events && evt.meta.events.length) || 0 } });
        demoPush(marker);
        return;
      }
      demoPush(evt);
      return;
    }
    const url = ENDPOINT + "/collect";
    const body = JSON.stringify(evt);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch { /* fall through */ }
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  }

  function track(type, meta) {
    send(buildEvent(type, meta));
  }

  /* ---------- Session replay (compact, no keystrokes / no input values) ---------- */
  const replay = {
    start: Date.now(),
    buf: [],
    total: 0,
    lastMouse: 0,
    stopped: false,
  };

  function replayPush(tuple) {
    if (replay.stopped || replay.total >= REPLAY_MAX_EVENTS) return;
    replay.buf.push(tuple);
    replay.total++;
    if (replay.buf.length >= REPLAY_MAX_BATCH) flushReplay(false);
  }

  function flushReplay(force) {
    if (!replay.buf.length) return;
    if (!force && replay.buf.length < 5) return;
    const batch = replay.buf.splice(0, REPLAY_MAX_BATCH);
    track("replay_batch", {
      start: replay.start,
      events: batch,
    });
  }

  function normXY(e) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const x = Math.max(0, Math.min(1000, Math.round(((e.clientX || 0) / w) * 1000)));
    const y = Math.max(0, Math.min(1000, Math.round(((e.clientY || 0) / h) * 1000)));
    return [x, y];
  }

  function relT() {
    return Math.max(0, Date.now() - replay.start);
  }

  function isSensitiveTarget(t) {
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (t.isContentEditable) return true;
    return false;
  }

  function setupReplay() {
    replayPush(["v", relT(), Math.min(4000, window.innerWidth | 0), Math.min(4000, window.innerHeight | 0)]);
    replayPush(["p", relT(), pagePath().slice(0, 120)]);
    const sec = sectionFromUrl();
    if (sec) replayPush(["n", relT(), String(sec).slice(0, 40)]);

    window.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - replay.lastMouse < REPLAY_MOUSE_MS) return;
      replay.lastMouse = now;
      const [x, y] = normXY(e);
      replayPush(["m", relT(), x, y]);
    }, { passive: true });

    window.addEventListener("click", (e) => {
      // Record click position only — never input values
      if (isSensitiveTarget(e.target)) {
        replayPush(["c", relT(), -1, -1]); // masked click on form control
        return;
      }
      const [x, y] = normXY(e);
      replayPush(["c", relT(), x, y]);
    }, true);

    window.addEventListener("scroll", () => {
      const maxY = Math.max(1, (document.documentElement.scrollHeight || 1) - window.innerHeight);
      const sy = Math.max(0, Math.min(1000, Math.round((window.scrollY / maxY) * 1000)));
      const maxX = Math.max(1, (document.documentElement.scrollWidth || 1) - window.innerWidth);
      const sx = Math.max(0, Math.min(1000, Math.round((window.scrollX / maxX) * 1000)));
      replayPush(["s", relT(), sx, sy]);
    }, { passive: true });

    window.addEventListener("resize", () => {
      replayPush(["v", relT(), Math.min(4000, window.innerWidth | 0), Math.min(4000, window.innerHeight | 0)]);
    }, { passive: true });

    setInterval(() => flushReplay(false), REPLAY_FLUSH_MS);
  }

  /* ---------- Scroll depth ---------- */
  const scrollSeen = new Set();
  function checkScroll() {
    const el = document.documentElement;
    const max = Math.max(1, (el.scrollHeight || 1) - window.innerHeight);
    const pct = Math.round((window.scrollY / max) * 100);
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !scrollSeen.has(m)) {
        scrollSeen.add(m);
        track("scroll_depth", { depth: m });
        replayPush(["d", relT(), m]);
      }
    }
  }

  /* ---------- Time on page ---------- */
  let pageEntered = Date.now();
  let visibleAcc = 0;
  let visibleSince = Date.now();
  let lastSection = sectionFromUrl();
  let sectionEntered = Date.now();

  function flushTime(reason) {
    if (document.visibilityState === "visible") {
      visibleAcc += Date.now() - visibleSince;
      visibleSince = Date.now();
    }
    const ms = Math.min(visibleAcc, 60 * 60 * 1000);
    if (ms < 400) return;
    track("time_on_page", {
      ms,
      reason: reason || "tick",
      section: lastSection || "",
    });
    visibleAcc = 0;
  }

  function onSectionChange(next) {
    if (!next || next === lastSection) return;
    const ms = Math.min(Date.now() - sectionEntered, 60 * 60 * 1000);
    if (lastSection && ms >= 400) {
      track("time_on_section", { section: lastSection, ms });
    }
    lastSection = next;
    sectionEntered = Date.now();
    pushPath("sec:" + next);
    track("section_view", { section: next });
    replayPush(["n", relT(), String(next).slice(0, 40)]);
  }

  /* ---------- Click heatmap (aggregate positions; skip form fields) ---------- */
  let lastHeat = 0;
  function onHeatClick(e) {
    if (isSensitiveTarget(e.target)) return;
    const now = Date.now();
    if (now - lastHeat < HEAT_THROTTLE_MS) return;
    lastHeat = now;
    const doc = document.documentElement;
    const w = Math.max(1, doc.scrollWidth || window.innerWidth);
    const h = Math.max(1, doc.scrollHeight || window.innerHeight);
    const x = Math.max(0, Math.min(1000, Math.round((((e.pageX || e.clientX || 0)) / w) * 1000)));
    const y = Math.max(0, Math.min(1000, Math.round((((e.pageY || e.clientY || 0)) / h) * 1000)));
    track("click_heat", { x, y, path: pagePath() });
  }

  /* ---------- Session end / bounce / landing-exit ---------- */
  let pageviewCount = 0;
  function markPageview() {
    pageviewCount++;
    const path = pagePath();
    const landing = getLanding();
    const pathArr = pushPath(path);
    const sec = sectionFromUrl();
    if (sec) pushPath("sec:" + sec);

    track("pageview", {
      landing,
      path_len: pathArr.length,
      returning: !isNewVisitor,
    });
    replayPush(["p", relT(), path.slice(0, 120)]);
  }

  function endSession(reason) {
    flushTime(reason);
    flushReplay(true);
    const pathArr = getPathArr();
    const landing = getLanding();
    const exit = pagePath();
    const duration = Math.min(Date.now() - replay.start, 60 * 60 * 1000);
    const bounced = pageviewCount <= 1 && duration < 12000 && scrollSeen.size === 0;
    track("session_end", {
      landing,
      exit,
      path: pathArr.slice(0, 40),
      bounced: !!bounced,
      duration_ms: duration,
      returning: !isNewVisitor,
      pageviews: pageviewCount,
      reason: reason || "leave",
    });
    replay.stopped = true;
  }

  // Public API for site.js hooks
  window.hvAnalytics = {
    track,
    pageview: () => markPageview(),
    productOpen: (sku, title) => {
      track("product_open", { sku: sku || "", title: title || "" });
      replayPush(["o", relT(), String(sku || title || "").slice(0, 40)]);
    },
    cta: (name, label) => {
      track("cta_click", { cta: name || "cta", label: label || "" });
      replayPush(["t", relT(), String(name || "cta").slice(0, 40)]);
    },
    isDemo: () => DEMO,
    endpoint: () => ENDPOINT,
    _demoRead: () => {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
    },
    _demoClear: () => {
      try {
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(REPLAY_STORE_KEY);
      } catch {}
    },
    _demoReadReplays: () => {
      try { return JSON.parse(localStorage.getItem(REPLAY_STORE_KEY) || "{}"); } catch { return {}; }
    },
  };

  // Skip admin pages (content editor + stats)
  const path = location.pathname || "";
  if (/\/admin\/?$/.test(path) || /\/admin\/index\.html$/.test(path)) return;
  if (/\/admin\/stats\//.test(path)) return;

  function boot() {
    getVid(); // sets isNewVisitor
    getSid();
    getLanding();
    setupReplay();
    markPageview();

    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    document.addEventListener("click", onHeatClick, true);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        visibleAcc += Date.now() - visibleSince;
        flushTime("hidden");
        flushReplay(true);
      } else {
        visibleSince = Date.now();
      }
    });

    window.addEventListener("pagehide", () => endSession("pagehide"));
    // Fallback for some browsers
    window.addEventListener("beforeunload", () => {
      flushTime("unload");
      flushReplay(true);
    });

    // Watch SPA-ish section changes via dataset + popstate
    setInterval(() => {
      const next = sectionFromUrl();
      onSectionChange(next);
    }, 1200);

    window.addEventListener("popstate", () => {
      onSectionChange(sectionFromUrl());
      const p = pagePath();
      pushPath(p);
      track("path_step", { path: p });
      replayPush(["p", relT(), p.slice(0, 120)]);
    });

    // Periodic time heartbeat (keeps demo useful without needing leave)
    setInterval(() => {
      if (document.visibilityState === "visible") flushTime("heartbeat");
    }, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
