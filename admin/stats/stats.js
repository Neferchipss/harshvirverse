(function () {
  "use strict";
  const cfg = window.HV_ANALYTICS || {};
  const ENDPOINT = (cfg.ENDPOINT || "").replace(/\/$/, "");
  const DEMO = !ENDPOINT;
  const TOKEN_KEY = "hv_stats_token";

  const $ = (s, r = document) => r.querySelector(s);
  const login = $("#login");
  const dash = $("#dash");
  const err = $("#login-err");
  const mode = $("#mode");
  const actions = $("#bar-actions");

  mode.textContent = DEMO ? "DEMO (this browser only)" : "Live Worker";
  $("#demo-note").textContent = DEMO
    ? "Demo mode: endpoint not set. Password is the placeholder in analytics-config.js (default change-me-hv-stats). Events are only those recorded in THIS browser."
    : "Live mode: password is the one you set on the Cloudflare Worker (see analytics/README.md).";

  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch {} }

  function showDash(on) {
    login.hidden = on;
    dash.hidden = !on;
    actions.hidden = !on;
  }

  function barChart(el, values) {
    const max = Math.max(1, ...values);
    el.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "bars";
    values.forEach((v, i) => {
      const b = document.createElement("i");
      b.style.height = Math.max(2, Math.round((v / max) * 90)) + "px";
      b.title = `${i}:00 IST — ${v}`;
      wrap.append(b);
    });
    el.append(wrap);
  }

  function list(el, rows) {
    el.innerHTML = "";
    if (!rows || !rows.length) {
      el.innerHTML = '<p class="muted">No data yet.</p>';
      return;
    }
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "row";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = r.name;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(r.count);
      row.append(name, count);
      el.append(row);
    });
  }

  function cards(totals) {
    const el = $("#cards");
    const items = [
      ["Pageviews", totals.pageviews],
      ["Approx. unique", totals.uniqueVisitorsApprox],
      ["All events", totals.events],
    ];
    el.innerHTML = items.map(([k, v]) => `<div class="card"><div class="k">${k}</div><div class="v">${v ?? 0}</div></div>`).join("");
  }

  function fmtIST(iso) {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Calcutta",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function recentTable(el, rows) {
    el.innerHTML = "";
    if (!rows || !rows.length) {
      el.innerHTML = '<p class="muted">No recent events.</p>';
      return;
    }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Time (IST)</th><th>Type</th><th>Path / section</th><th>Source</th><th>Device</th><th>Country</th><th>Meta</th></tr></thead>";
    const tb = document.createElement("tbody");
    rows.forEach((e) => {
      const tr = document.createElement("tr");
      const meta = e.meta ? Object.values(e.meta).filter(Boolean).join(" · ") : "";
      tr.innerHTML = `<td>${fmtIST(e.t)}</td><td>${e.type}</td><td>${e.path || ""}${e.section ? " · " + e.section : ""}</td><td>${e.source || ""}</td><td>${e.device || ""}</td><td>${e.country || ""}</td><td>${meta}</td>`;
      tb.append(tr);
    });
    table.append(tb);
    el.append(table);
  }

  function classifySource(ref, utm) {
    const u = (utm || "").toLowerCase();
    if (u.includes("instagram") || u === "ig") return "instagram";
    if (u === "x" || u === "twitter") return "x";
    if (u.includes("linkedin")) return "linkedin";
    if (u.includes("superhive") || u.includes("blendermarket")) return "superhive";
    if (u.includes("google")) return "google";
    if (!ref) return "direct";
    let host = "";
    try { host = new URL(ref).hostname.toLowerCase(); } catch { return "other"; }
    if (host.includes("instagram.")) return "instagram";
    if (host === "t.co" || host.includes("twitter.") || host.includes("x.com")) return "x";
    if (host.includes("linkedin.") || host.includes("lnkd.in")) return "linkedin";
    if (host.includes("google.")) return "google";
    if (host.includes("superhive") || host.includes("blendermarket") || host.includes("gumroad")) return "superhive";
    if (host.includes("harshvirverse") || host.includes("github.io")) return "direct";
    return "other";
  }

  function aggregateLocal(events) {
    const byDevice = { phone: 0, tablet: 0, desktop: 0 };
    const byCountry = {};
    const bySource = {};
    const byPath = {};
    const bySection = {};
    const byHourIST = Array.from({ length: 24 }, () => 0);
    const byDayMap = {};
    const products = {};
    const ctas = {};
    const vids = new Set();
    let pageviews = 0;

    for (const e of events) {
      vids.add(e.vid);
      if (e.type === "pageview") pageviews++;
      byDevice[e.device] = (byDevice[e.device] || 0) + 1;
      const country = e.country || "XX";
      byCountry[country] = (byCountry[country] || 0) + 1;
      const src = e.source || classifySource(e.ref, e.utm_source);
      bySource[src] = (bySource[src] || 0) + 1;
      byPath[e.path || "/"] = (byPath[e.path || "/"] || 0) + 1;
      if (e.section) bySection[e.section] = (bySection[e.section] || 0) + 1;
      const t = new Date(e.t || Date.now());
      const ist = new Date(t.getTime() + (5 * 60 + 30) * 60 * 1000);
      byHourIST[ist.getUTCHours()]++;
      const day = ist.toISOString().slice(0, 10);
      byDayMap[day] = (byDayMap[day] || 0) + 1;
      if (e.type === "product_open") {
        const k = (e.meta && (e.meta.sku || e.meta.title)) || "unknown";
        products[k] = (products[k] || 0) + 1;
      }
      if (e.type === "cta_click") {
        const k = (e.meta && (e.meta.cta || e.meta.label)) || "cta";
        ctas[k] = (ctas[k] || 0) + 1;
      }
    }
    const top = (obj, n = 12) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
    const recent = [...events].sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 80).map((e) => ({
      t: e.t, type: e.type, path: e.path, section: e.section,
      source: e.source || classifySource(e.ref, e.utm_source),
      device: e.device, country: e.country || "XX", meta: e.meta || {},
    }));
    return {
      totals: { events: events.length, pageviews, uniqueVisitorsApprox: vids.size },
      byDevice, byCountry: top(byCountry, 20), bySource: top(bySource, 20),
      byPath: top(byPath, 20), bySection: top(bySection, 20), byHourIST,
      byDay: Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
      products: top(products, 20), ctas: top(ctas, 20), recent,
    };
  }

  function render(data) {
    cards(data.totals || {});
    list($("#by-day"), (data.byDay || []).map((d) => ({ name: d.day, count: d.count })));
    barChart($("#by-hour"), data.byHourIST || Array(24).fill(0));
    list($("#by-device"), Object.entries(data.byDevice || {}).map(([name, count]) => ({ name, count })));
    list($("#by-source"), data.bySource || []);
    list($("#by-country"), data.byCountry || []);
    list($("#by-path"), data.byPath || []);
    list($("#by-section"), data.bySection || []);
    list($("#products"), data.products || []);
    list($("#ctas"), data.ctas || []);
    recentTable($("#recent"), data.recent || []);
  }

  async function loadStats() {
    const days = Number($("#days").value || 30);
    if (DEMO) {
      const all = (window.hvAnalytics && window.hvAnalytics._demoRead()) || [];
      const cutoff = Date.now() - days * 86400000;
      const filtered = all.filter((e) => new Date(e.t).getTime() >= cutoff);
      render(aggregateLocal(filtered));
      return;
    }
    const res = await fetch(`${ENDPOINT}/admin/stats?days=${days}`, {
      headers: { authorization: "Bearer " + token() },
    });
    if (res.status === 401) {
      setToken("");
      showDash(false);
      err.textContent = "Session expired. Sign in again.";
      return;
    }
    if (!res.ok) throw new Error("Failed to load stats (" + res.status + ")");
    render(await res.json());
  }

  async function doLogin() {
    err.textContent = "";
    const password = $("#password").value || "";
    if (DEMO) {
      const expect = cfg.DEMO_PASSWORD || "change-me-hv-stats";
      if (password !== expect) {
        err.textContent = "Wrong password.";
        return;
      }
      setToken("demo");
      showDash(true);
      await loadStats();
      return;
    }
    const res = await fetch(ENDPOINT + "/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      err.textContent = "Wrong password.";
      return;
    }
    const data = await res.json();
    setToken(data.token);
    showDash(true);
    await loadStats();
  }

  async function doLogout() {
    if (!DEMO && token()) {
      try {
        await fetch(ENDPOINT + "/admin/logout", {
          method: "POST",
          headers: { authorization: "Bearer " + token() },
        });
      } catch { /* ignore */ }
    }
    setToken("");
    showDash(false);
  }

  $("#btn-login").addEventListener("click", () => doLogin().catch((e) => { err.textContent = String(e.message || e); }));
  $("#password").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-login").click(); });
  $("#btn-logout").addEventListener("click", () => doLogout());
  $("#btn-refresh").addEventListener("click", () => loadStats().catch((e) => alert(e.message)));
  $("#days").addEventListener("change", () => loadStats().catch((e) => alert(e.message)));

  if (token()) {
    showDash(true);
    loadStats().catch(() => { setToken(""); showDash(false); });
  }
})();
