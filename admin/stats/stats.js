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
    ? "Demo mode: endpoint not set. Password is the placeholder in analytics-config.js (default change-me-hv-stats). Events + replays are only from THIS browser."
    : "Live mode: password is the one you set on the Cloudflare Worker (see analytics/README.md).";

  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch {} }

  function showDash(on) {
    login.hidden = on;
    dash.hidden = !on;
    actions.hidden = !on;
    login.style.display = on ? "none" : "";
    dash.style.display = on ? "" : "none";
    actions.style.display = on ? "" : "none";
    if (on) {
      const pw = $("#password");
      if (pw) pw.value = "";
      err.textContent = "";
    }
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
      count.textContent = r.extra != null ? String(r.extra) : String(r.count);
      row.append(name, count);
      el.append(row);
    });
  }

  function cards(totals) {
    const el = $("#cards");
    const items = [
      ["Pageviews", totals.pageviews],
      ["Approx. unique", totals.uniqueVisitorsApprox],
      ["Sessions", totals.sessionsApprox],
      ["Avg time on page", totals.avgTimeOnPageMs ? Math.round(totals.avgTimeOnPageMs / 1000) + "s" : "—"],
      ["Bounce rate", totals.bounceRate != null ? totals.bounceRate + "%" : "—"],
      ["New PV", totals.newVisitorPageviews],
      ["Returning PV", totals.returningPageviews],
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
    table.innerHTML = "<thead><tr><th>Time (IST)</th><th>Type</th><th>Path / section</th><th>Source</th><th>Device</th><th>Screen</th><th>Lang</th><th>Country</th><th>Meta</th></tr></thead>";
    const tb = document.createElement("tbody");
    rows.forEach((e) => {
      const tr = document.createElement("tr");
      const meta = e.meta ? Object.entries(e.meta).filter(([, v]) => v !== "" && v != null && typeof v !== "object").map(([k, v]) => `${k}:${v}`).join(" · ") : "";
      tr.innerHTML = `<td>${fmtIST(e.t)}</td><td>${e.type}</td><td>${e.path || ""}${e.section ? " · " + e.section : ""}</td><td>${e.source || ""}</td><td>${e.device || ""}</td><td>${e.screen || ""}</td><td>${e.lang || ""}</td><td>${e.country || ""}</td><td>${meta}</td>`;
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

  function top(obj, n = 12) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  }

  function aggregateLocal(events) {
    const byDevice = { phone: 0, tablet: 0, desktop: 0 };
    const byCountry = {};
    const bySource = {};
    const byPath = {};
    const bySection = {};
    const byHourIST = Array.from({ length: 24 }, () => 0);
    const byDayMap = {};
    const byScreen = {};
    const byLang = {};
    const products = {};
    const ctas = {};
    const scrollDepth = { 25: 0, 50: 0, 75: 0, 100: 0 };
    const heatByPath = {};
    const landings = {};
    const exits = {};
    const sessionPaths = [];
    const sessions = {};
    const vids = new Set();
    const sids = new Set();
    let pageviews = 0;
    let timeSum = 0;
    let timeN = 0;
    const sectionTime = {};
    let bounced = 0;
    let sessionEnds = 0;
    let newVisitors = 0;
    let returningPV = 0;

    for (const e of events) {
      if (e.vid) vids.add(e.vid);
      if (e.sid) sids.add(e.sid);
      byDevice[e.device] = (byDevice[e.device] || 0) + 1;
      byCountry[e.country || "XX"] = (byCountry[e.country || "XX"] || 0) + 1;
      const src = e.source || classifySource(e.ref, e.utm_source);
      bySource[src] = (bySource[src] || 0) + 1;
      if (e.screen) byScreen[e.screen] = (byScreen[e.screen] || 0) + 1;
      if (e.lang) byLang[e.lang] = (byLang[e.lang] || 0) + 1;

      const t = new Date(e.t || Date.now());
      const ist = new Date(t.getTime() + (5 * 60 + 30) * 60 * 1000);
      byHourIST[ist.getUTCHours()]++;
      const day = ist.toISOString().slice(0, 10);
      byDayMap[day] = (byDayMap[day] || 0) + 1;

      if (e.type === "pageview") {
        pageviews++;
        byPath[e.path || "/"] = (byPath[e.path || "/"] || 0) + 1;
        if (e.section) bySection[e.section] = (bySection[e.section] || 0) + 1;
        if (e.is_new) newVisitors++;
        if (e.meta && e.meta.returning) returningPV++;
        if (e.meta && e.meta.landing) landings[e.meta.landing] = (landings[e.meta.landing] || 0) + 1;
      }
      if (e.type === "section_view" && e.meta && e.meta.section) {
        bySection[e.meta.section] = (bySection[e.meta.section] || 0) + 1;
      }
      if (e.type === "product_open") {
        const k = (e.meta && (e.meta.sku || e.meta.title)) || "unknown";
        products[k] = (products[k] || 0) + 1;
      }
      if (e.type === "cta_click") {
        const k = (e.meta && (e.meta.cta || e.meta.label)) || "cta";
        ctas[k] = (ctas[k] || 0) + 1;
      }
      if (e.type === "scroll_depth" && e.meta && e.meta.depth != null) {
        const d = String(e.meta.depth);
        if (scrollDepth[d] != null) scrollDepth[d]++;
      }
      if (e.type === "time_on_page" && e.meta && e.meta.ms) {
        timeSum += e.meta.ms;
        timeN++;
      }
      if (e.type === "time_on_section" && e.meta && e.meta.section) {
        const s = e.meta.section;
        if (!sectionTime[s]) sectionTime[s] = { ms: 0, n: 0 };
        sectionTime[s].ms += e.meta.ms || 0;
        sectionTime[s].n++;
      }
      if (e.type === "click_heat" && e.meta && e.meta.x != null) {
        const hp = (e.meta.path || e.path || "/").slice(0, 300);
        if (!heatByPath[hp]) heatByPath[hp] = [];
        if (heatByPath[hp].length < 2000) heatByPath[hp].push({ x: e.meta.x, y: e.meta.y });
      }
      if (e.type === "session_end") {
        sessionEnds++;
        if (e.meta && e.meta.bounced) bounced++;
        if (e.meta && e.meta.exit) exits[e.meta.exit] = (exits[e.meta.exit] || 0) + 1;
        if (e.meta && Array.isArray(e.meta.path)) {
          sessionPaths.push({
            sid: e.sid,
            path: e.meta.path,
            duration_ms: e.meta.duration_ms || 0,
            bounced: !!e.meta.bounced,
            landing: e.meta.landing,
            exit: e.meta.exit,
            t: e.t,
            device: e.device,
            country: e.country || "XX",
          });
        }
      }
      if (e.sid) {
        const s = sessions[e.sid] || {
          sid: e.sid, vid: e.vid, t: e.t, device: e.device, country: e.country || "XX",
          lang: e.lang, screen: e.screen, path: e.path, events: 0, hasReplay: false,
        };
        s.events++;
        if (e.t && (!s.t || e.t < s.t)) s.t = e.t;
        if (e.type === "replay_meta" || e.type === "replay_batch") s.hasReplay = true;
        if (e.type === "pageview") s.path = e.path;
        if (e.type === "session_end" && e.meta) {
          s.duration_ms = e.meta.duration_ms;
          s.bounced = e.meta.bounced;
          s.exit = e.meta.exit;
          s.landing = e.meta.landing;
          s.pathList = e.meta.path;
        }
        sessions[e.sid] = s;
      }
    }

    // Mark replays present in demo store
    const replays = (window.hvAnalytics && window.hvAnalytics._demoReadReplays && window.hvAnalytics._demoReadReplays()) || {};
    Object.keys(replays).forEach((sid) => {
      if (!sessions[sid]) {
        sessions[sid] = {
          sid,
          vid: replays[sid].vid,
          t: new Date(replays[sid].start || Date.now()).toISOString(),
          device: (replays[sid].meta && replays[sid].meta.device) || "",
          country: "XX",
          path: (replays[sid].meta && replays[sid].meta.path) || "/",
          events: (replays[sid].events || []).length,
          hasReplay: true,
        };
      } else {
        sessions[sid].hasReplay = true;
      }
    });

    const recent = [...events]
      .filter((e) => e.type !== "replay_batch" && e.type !== "click_heat")
      .sort((a, b) => (a.t < b.t ? 1 : -1))
      .slice(0, 100)
      .map((e) => ({
        t: e.t, type: e.type, path: e.path, section: e.section,
        source: e.source || classifySource(e.ref, e.utm_source),
        device: e.device, country: e.country || "XX", lang: e.lang, screen: e.screen,
        sid: e.sid, meta: e.meta || {},
      }));

    return {
      totals: {
        events: events.length,
        pageviews,
        uniqueVisitorsApprox: vids.size,
        sessionsApprox: sids.size || Object.keys(sessions).length,
        avgTimeOnPageMs: timeN ? Math.round(timeSum / timeN) : 0,
        bounceRate: sessionEnds ? Math.round((bounced / sessionEnds) * 1000) / 10 : 0,
        newVisitorPageviews: newVisitors,
        returningPageviews: returningPV,
        sessionEnds,
      },
      byDevice,
      byCountry: top(byCountry, 20),
      bySource: top(bySource, 20),
      byPath: top(byPath, 20),
      bySection: top(bySection, 20),
      byScreen: top(byScreen, 10),
      byLang: top(byLang, 15),
      byHourIST,
      byDay: Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
      products: top(products, 20),
      ctas: top(ctas, 20),
      scrollDepth,
      landings: top(landings, 15),
      exits: top(exits, 15),
      sectionTime: Object.entries(sectionTime).map(([name, v]) => ({
        name, count: v.n, avg_ms: v.n ? Math.round(v.ms / v.n) : 0,
      })).sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 20),
      sessionPaths: sessionPaths.sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 40),
      sessions: Object.values(sessions).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 60),
      heat: heatByPath,
      recent,
    };
  }

  /* ---------- Heatmap ---------- */
  let heatData = {};
  function renderHeat(path) {
    const canvas = $("#heat-canvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#0e1014";
    ctx.fillRect(0, 0, W, H);
    // page frame
    ctx.strokeStyle = "#2a2e36";
    ctx.strokeRect(20, 20, W - 40, H - 40);
    const pts = heatData[path] || [];
    $("#heat-count").textContent = pts.length ? pts.length + " clicks" : "No clicks for this path";
    pts.forEach((p) => {
      const x = 20 + ((p.x || 0) / 1000) * (W - 40);
      const y = 20 + ((p.y || 0) / 1000) * (H - 40);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
      g.addColorStop(0, "rgba(200,164,90,0.55)");
      g.addColorStop(1, "rgba(200,164,90,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function setupHeat(data) {
    heatData = data.heat || {};
    const sel = $("#heat-path");
    const paths = Object.keys(heatData);
    sel.innerHTML = "";
    if (!paths.length) {
      sel.innerHTML = "<option value=\"\">No heatmap data yet</option>";
      renderHeat("");
      return;
    }
    paths.sort((a, b) => (heatData[b].length || 0) - (heatData[a].length || 0));
    paths.forEach((p) => {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = `${p} (${heatData[p].length})`;
      sel.append(o);
    });
    sel.onchange = () => renderHeat(sel.value);
    renderHeat(sel.value);
  }

  /* ---------- Session paths ---------- */
  function renderSessionPaths(el, rows) {
    el.innerHTML = "";
    if (!rows || !rows.length) {
      el.innerHTML = '<p class="muted">No session paths yet. Browse the site, then leave or wait for heartbeat.</p>';
      return;
    }
    rows.forEach((r) => {
      const div = document.createElement("div");
      div.className = "row";
      div.style.flexWrap = "wrap";
      const head = document.createElement("div");
      head.style.width = "100%";
      head.innerHTML = `<span class="muted">${fmtIST(r.t)}</span> · ${r.device || ""} · ${r.country || ""} · ${Math.round((r.duration_ms || 0) / 1000)}s`
        + (r.bounced ? ' <span class="badge warn">bounce</span>' : "");
      const chips = document.createElement("div");
      chips.style.width = "100%";
      chips.style.marginTop = "4px";
      (r.path || []).forEach((p) => {
        const s = document.createElement("span");
        s.className = "path-chip";
        s.textContent = p;
        chips.append(s);
      });
      div.append(head, chips);
      el.append(div);
    });
  }

  /* ---------- Replay player ---------- */
  const replayState = {
    events: [],
    duration: 0,
    t: 0,
    playing: false,
    raf: 0,
    lastWall: 0,
    cursor: { x: 0.5, y: 0.5 },
    scroll: 0,
    vw: 1280,
    vh: 720,
    path: "",
    sid: "",
  };

  function drawReplayFrame() {
    const canvas = $("#replay-canvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#0e1014";
    ctx.fillRect(0, 0, W, H);

    // schematic page
    const pad = 24;
    ctx.fillStyle = "#161920";
    ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2);
    ctx.strokeStyle = "#2a2e36";
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

    // fake content blocks that shift with scroll
    const scrollPx = (replayState.scroll / 1000) * 200;
    ctx.fillStyle = "#1c2028";
    for (let i = 0; i < 6; i++) {
      const y = pad + 60 + i * 70 - scrollPx;
      if (y < pad || y > H - pad - 40) continue;
      ctx.fillRect(pad + 30, y, W - pad * 2 - 60, 40);
    }

    ctx.fillStyle = "#c8a45a";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(replayState.path || "/", pad + 12, pad + 28);

    // cursor
    const cx = pad + replayState.cursor.x * (W - pad * 2);
    const cy = pad + replayState.cursor.y * (H - pad * 2);
    ctx.beginPath();
    ctx.fillStyle = "rgba(200,164,90,0.9)";
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 14, cy + 18);
    ctx.lineTo(cx + 6, cy + 18);
    ctx.lineTo(cx + 10, cy + 28);
    ctx.lineTo(cx + 4, cy + 30);
    ctx.lineTo(cx, cy + 18);
    ctx.closePath();
    ctx.fill();

    // time readout
    ctx.fillStyle = "#9aa0a6";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`${(replayState.t / 1000).toFixed(1)}s / ${(replayState.duration / 1000).toFixed(1)}s`, pad + 12, H - 12);
  }

  function applyReplayUntil(t) {
    replayState.cursor = { x: 0.5, y: 0.5 };
    replayState.scroll = 0;
    replayState.path = "";
    for (const ev of replayState.events) {
      if (ev[1] > t) break;
      const kind = ev[0];
      if (kind === "m" || kind === "c") {
        if (ev[2] >= 0 && ev[3] >= 0) {
          replayState.cursor = { x: ev[2] / 1000, y: ev[3] / 1000 };
        }
      } else if (kind === "s") {
        replayState.scroll = ev[3] || 0;
      } else if (kind === "v") {
        replayState.vw = ev[2] || replayState.vw;
        replayState.vh = ev[3] || replayState.vh;
      } else if (kind === "p") {
        replayState.path = ev[2] || "";
      } else if (kind === "n") {
        replayState.path = (replayState.path || "") + " · " + (ev[2] || "");
      }
    }
    drawReplayFrame();
  }

  function replayTick(now) {
    if (!replayState.playing) return;
    const speed = Number($("#replay-speed").value || 2);
    const dt = (now - replayState.lastWall) * speed;
    replayState.lastWall = now;
    replayState.t = Math.min(replayState.duration, replayState.t + dt);
    $("#replay-seek").value = String(Math.round(replayState.t));
    applyReplayUntil(replayState.t);
    if (replayState.t >= replayState.duration) {
      replayState.playing = false;
      return;
    }
    replayState.raf = requestAnimationFrame(replayTick);
  }

  function loadReplayPayload(payload) {
    const events = (payload && payload.events) || [];
    replayState.events = events;
    replayState.duration = events.reduce((m, e) => Math.max(m, e[1] || 0), 0) || 1;
    replayState.t = 0;
    replayState.sid = payload.sid || "";
    replayState.path = (payload.meta && payload.meta.path) || "";
    $("#replay-seek").max = String(Math.round(replayState.duration));
    $("#replay-seek").value = "0";
    $("#replay-meta").textContent = `${events.length} events · sid ${String(replayState.sid).slice(0, 8)}…`;
    applyReplayUntil(0);
  }

  async function fetchReplay(sid) {
    if (DEMO) {
      const map = (window.hvAnalytics && window.hvAnalytics._demoReadReplays()) || {};
      const payload = map[sid];
      if (!payload) throw new Error("Replay not found in this browser");
      loadReplayPayload(payload);
      return;
    }
    const res = await fetch(`${ENDPOINT}/admin/replay?sid=${encodeURIComponent(sid)}`, {
      headers: { authorization: "Bearer " + token() },
    });
    if (!res.ok) throw new Error("Replay load failed (" + res.status + ")");
    loadReplayPayload(await res.json());
  }

  function renderReplayList(sessions) {
    const el = $("#replay-list");
    el.innerHTML = "";
    const withReplay = (sessions || []).filter((s) => s.hasReplay || true);
    if (!withReplay.length) {
      el.innerHTML = '<p class="muted" style="padding:12px">No sessions yet. Browse the site first.</p>';
      return;
    }
    withReplay.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "replay-item" + (s.sid === replayState.sid ? " active" : "");
      btn.innerHTML = `<div class="t">${fmtIST(s.t)} · ${s.device || "?"} · ${s.country || "XX"}`
        + (s.hasReplay ? ' <span class="badge ok">replay</span>' : "")
        + (s.bounced ? ' <span class="badge warn">bounce</span>' : "")
        + `</div><div class="p">${s.path || s.landing || "/"}</div>`;
      btn.addEventListener("click", () => {
        el.querySelectorAll(".replay-item").forEach((n) => n.classList.remove("active"));
        btn.classList.add("active");
        fetchReplay(s.sid).catch((e) => alert(e.message));
      });
      el.append(btn);
    });
  }

  $("#replay-play").addEventListener("click", () => {
    if (!replayState.events.length) return;
    if (replayState.t >= replayState.duration) replayState.t = 0;
    replayState.playing = true;
    replayState.lastWall = performance.now();
    cancelAnimationFrame(replayState.raf);
    replayState.raf = requestAnimationFrame(replayTick);
  });
  $("#replay-pause").addEventListener("click", () => {
    replayState.playing = false;
    cancelAnimationFrame(replayState.raf);
  });
  $("#replay-seek").addEventListener("input", () => {
    replayState.t = Number($("#replay-seek").value || 0);
    applyReplayUntil(replayState.t);
  });

  function render(data) {
    cards(data.totals || {});
    list($("#by-day"), (data.byDay || []).map((d) => ({ name: d.day, count: d.count })));
    barChart($("#by-hour"), data.byHourIST || Array(24).fill(0));
    list($("#by-device"), Object.entries(data.byDevice || {}).map(([name, count]) => ({ name, count })));
    list($("#by-screen"), data.byScreen || []);
    list($("#by-source"), data.bySource || []);
    list($("#by-country"), data.byCountry || []);
    list($("#by-lang"), data.byLang || []);
    list($("#scroll-depth"), Object.entries(data.scrollDepth || {}).map(([name, count]) => ({ name: name + "%", count })));
    list($("#landings"), data.landings || []);
    list($("#exits"), data.exits || []);
    list($("#by-path"), data.byPath || []);
    list($("#by-section"), data.bySection || []);
    list($("#section-time"), (data.sectionTime || []).map((r) => ({
      name: r.name,
      count: r.count,
      extra: Math.round((r.avg_ms || 0) / 1000) + "s avg",
    })));
    list($("#products"), data.products || []);
    list($("#ctas"), data.ctas || []);
    renderSessionPaths($("#session-paths"), data.sessionPaths || []);
    setupHeat(data);
    renderReplayList(data.sessions || []);
    recentTable($("#recent"), data.recent || []);
    drawReplayFrame();
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
