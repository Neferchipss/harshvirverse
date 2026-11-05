/*! harshvirverse private first-party analytics (cookie-free).
   Sends pageviews + light engagement to your Cloudflare Worker, or stores
   locally in DEMO mode when HV_ANALYTICS.ENDPOINT is empty. */
(function () {
  "use strict";
  const cfg = window.HV_ANALYTICS || {};
  const ENDPOINT = (cfg.ENDPOINT || "").replace(/\/$/, "");
  const DEMO = !ENDPOINT;
  const STORE_KEY = "hv_analytics_demo_v1";
  const VID_KEY = "hv_vid";
  const SID_KEY = "hv_sid";
  const SID_TS = "hv_sid_ts";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getVid() {
    try {
      let v = localStorage.getItem(VID_KEY);
      if (!v) { v = uuid(); localStorage.setItem(VID_KEY, v); }
      return v;
    } catch { return uuid(); }
  }

  function getSid() {
    try {
      const now = Date.now();
      let sid = sessionStorage.getItem(SID_KEY);
      const ts = Number(sessionStorage.getItem(SID_TS) || 0);
      // New session after 30 minutes idle
      if (!sid || now - ts > 30 * 60 * 1000) {
        sid = uuid();
        sessionStorage.setItem(SID_KEY, sid);
      }
      sessionStorage.setItem(SID_TS, String(now));
      return sid;
    } catch { return uuid(); }
  }

  function device() {
    const ua = navigator.userAgent || "";
    if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
    if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "phone";
    return "desktop";
  }

  function sectionFromUrl() {
    try {
      const s = new URLSearchParams(location.search).get("s");
      return s || (location.pathname.endsWith("index.html") || /\/$/.test(location.pathname) ? "home" : null);
    } catch { return null; }
  }

  function utmSource() {
    try { return new URLSearchParams(location.search).get("utm_source") || ""; } catch { return ""; }
  }

  function buildEvent(type, meta) {
    return {
      type: type || "pageview",
      path: (location.pathname + location.search).slice(0, 300) || "/",
      section: sectionFromUrl(),
      hash: (location.hash || "").slice(0, 120),
      ref: document.referrer ? document.referrer.slice(0, 500) : "",
      utm_source: utmSource(),
      device: device(),
      lang: (navigator.language || "").slice(0, 32),
      vid: getVid(),
      sid: getSid(),
      meta: meta || {},
      t: new Date().toISOString(),
    };
  }

  function demoPush(evt) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push(evt);
      while (list.length > 2000) list.shift();
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch { /* quota */ }
  }

  function send(evt) {
    if (DEMO) {
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
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, mode: "cors" }).catch(() => {});
  }

  function track(type, meta) {
    send(buildEvent(type, meta));
  }

  // Public API for site.js hooks
  window.hvAnalytics = {
    track,
    pageview: () => track("pageview"),
    productOpen: (sku, title) => track("product_open", { sku: sku || "", title: title || "" }),
    cta: (name, label) => track("cta_click", { cta: name || "cta", label: label || "" }),
    isDemo: () => DEMO,
    endpoint: () => ENDPOINT,
    /** Used by /admin/stats/ demo mode */
    _demoRead: () => {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
    },
    _demoClear: () => { try { localStorage.removeItem(STORE_KEY); } catch {} },
  };

  // Auto pageview once DOM is ready (skip admin content editor, keep stats page silent for itself)
  const path = location.pathname || "";
  if (/\/admin\/?$/.test(path) || /\/admin\/index\.html$/.test(path)) return;
  if (/\/admin\/stats\//.test(path)) return;

  const fire = () => track("pageview");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fire, { once: true });
  else fire();
})();
