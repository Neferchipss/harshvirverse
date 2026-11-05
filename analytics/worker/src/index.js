/**
 * harshvirverse private analytics — Cloudflare Worker
 * POST /collect              — public event ingest (CORS)
 * POST /admin/login          — password → session token
 * POST /admin/logout         — revoke session
 * GET  /admin/stats          — aggregated dashboard JSON (Bearer)
 * GET  /admin/replay?sid=    — session replay payload (Bearer)
 * GET  /health               — ok
 *
 * Privacy: never stores keystrokes or form field values.
 */

const enc = new TextEncoder();

const EVENT_TYPES = new Set([
  "pageview",
  "product_open",
  "cta_click",
  "scroll_depth",
  "time_on_page",
  "time_on_section",
  "section_view",
  "click_heat",
  "session_end",
  "path_step",
  "replay_batch",
  "replay_meta",
]);

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    "access-control-allow-origin": ok ? origin : allowed[0] || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function dayKey(d = new Date()) {
  return "day:" + d.toISOString().slice(0, 10);
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
  if (host.includes("google.") || host.includes("googleusercontent.")) return "google";
  if (host.includes("superhive") || host.includes("blendermarket") || host.includes("gumroad")) return "superhive";
  if (host.includes("harshvirverse") || host.includes("github.io")) return "direct";
  return "other";
}

function deviceFromUa(ua) {
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua || "")) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua || "")) return "phone";
  return "desktop";
}

async function verifyPassword(env, password) {
  const salt = env.ADMIN_SALT || "hv-analytics-v1";
  const expect = (env.ADMIN_PASSWORD_HASH || "").toLowerCase();
  if (!expect || !password) return false;
  const got = await sha256Hex(`${salt}:${password}`);
  if (got.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expect.charCodeAt(i);
  return diff === 0;
}

async function sessionOk(env, auth) {
  if (!auth || !auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token || token.length < 16) return false;
  const raw = await env.STATS.get("sess:" + token);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    if (!s.exp || Date.now() > s.exp) {
      await env.STATS.delete("sess:" + token);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeMeta(type, meta) {
  const out = {};
  if (!meta || typeof meta !== "object") return out;
  const str = (k, n) => {
    if (meta[k] != null) out[k] = String(meta[k]).slice(0, n);
  };
  const num = (k, min, max) => {
    const v = Number(meta[k]);
    if (Number.isFinite(v)) out[k] = Math.max(min, Math.min(max, Math.round(v)));
  };
  if (type === "product_open") {
    str("sku", 120); str("title", 120);
  } else if (type === "cta_click") {
    str("cta", 120); str("label", 120);
  } else if (type === "scroll_depth") {
    num("depth", 0, 100);
  } else if (type === "time_on_page" || type === "time_on_section") {
    num("ms", 0, 3600000);
    str("section", 80);
    str("reason", 40);
  } else if (type === "section_view") {
    str("section", 80);
  } else if (type === "click_heat") {
    num("x", 0, 1000); num("y", 0, 1000);
    str("path", 300);
  } else if (type === "session_end") {
    str("landing", 300); str("exit", 300); str("reason", 40);
    num("duration_ms", 0, 3600000); num("pageviews", 0, 500);
    if (typeof meta.bounced === "boolean") out.bounced = meta.bounced;
    if (typeof meta.returning === "boolean") out.returning = meta.returning;
    if (Array.isArray(meta.path)) {
      out.path = meta.path.slice(0, 40).map((p) => String(p).slice(0, 80));
    }
  } else if (type === "path_step") {
    str("path", 300);
  } else if (type === "pageview") {
    str("landing", 300);
    num("path_len", 0, 100);
    if (typeof meta.returning === "boolean") out.returning = meta.returning;
  } else if (type === "replay_batch") {
    num("start", 0, Date.now() + 86400000);
    if (Array.isArray(meta.events)) {
      out.events = meta.events.slice(0, 80).map(sanitizeReplayTuple).filter(Boolean);
    }
  } else if (type === "replay_meta") {
    num("n", 0, 5000);
  }
  return out;
}

function sanitizeReplayTuple(t) {
  if (!Array.isArray(t) || t.length < 2) return null;
  const kind = String(t[0] || "").slice(0, 2);
  const ms = Math.max(0, Math.min(3600000, Number(t[1]) || 0));
  // m/c: mouse/click with x,y in 0..1000 (or -1 masked)
  if (kind === "m" || kind === "c") {
    const x = Math.max(-1, Math.min(1000, Math.round(Number(t[2]) || 0)));
    const y = Math.max(-1, Math.min(1000, Math.round(Number(t[3]) || 0)));
    return [kind, ms, x, y];
  }
  if (kind === "s") {
    const sx = Math.max(0, Math.min(1000, Math.round(Number(t[2]) || 0)));
    const sy = Math.max(0, Math.min(1000, Math.round(Number(t[3]) || 0)));
    return [kind, ms, sx, sy];
  }
  if (kind === "v") {
    const w = Math.max(0, Math.min(4000, Math.round(Number(t[2]) || 0)));
    const h = Math.max(0, Math.min(4000, Math.round(Number(t[3]) || 0)));
    return [kind, ms, w, h];
  }
  if (kind === "p" || kind === "n" || kind === "o" || kind === "t") {
    return [kind, ms, String(t[2] || "").slice(0, 120)];
  }
  if (kind === "d") {
    return [kind, ms, Math.max(0, Math.min(100, Math.round(Number(t[2]) || 0)))];
  }
  return null;
}

function sanitizeEvent(body, request) {
  const ua = request.headers.get("user-agent") || "";
  const country = (request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "XX";
  const now = new Date().toISOString();
  const type = EVENT_TYPES.has(body.type) ? body.type : "pageview";
  const path = String(body.path || "/").slice(0, 300);
  const section = body.section != null ? String(body.section).slice(0, 80) : null;
  const hash = body.hash != null ? String(body.hash).slice(0, 120) : "";
  const ref = body.ref != null ? String(body.ref).slice(0, 500) : "";
  const utm = body.utm_source != null ? String(body.utm_source).slice(0, 80) : "";
  const vid = String(body.vid || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const sid = String(body.sid || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "";
  const lang = String(body.lang || "").slice(0, 32);
  const screen = ["xs", "sm", "md", "lg", "xl"].includes(body.screen) ? body.screen : "";
  const device = ["phone", "tablet", "desktop"].includes(body.device) ? body.device : deviceFromUa(ua);
  const vw = Math.max(0, Math.min(4000, Number(body.vw) || 0));
  const vh = Math.max(0, Math.min(4000, Number(body.vh) || 0));
  const is_new = !!body.is_new;
  const meta = sanitizeMeta(type, body.meta);

  return {
    t: now,
    type,
    path,
    section,
    hash,
    ref,
    source: classifySource(ref, utm),
    device,
    country: String(country).slice(0, 8),
    lang,
    screen,
    vw,
    vh,
    vid,
    sid,
    is_new,
    meta,
  };
}

async function appendEvent(env, evt) {
  // Replay batches go to dedicated KV keys; light marker stays in day stream
  if (evt.type === "replay_batch") {
    await appendReplay(env, evt);
    const marker = {
      t: evt.t,
      type: "replay_meta",
      path: evt.path,
      section: evt.section,
      device: evt.device,
      country: evt.country,
      lang: evt.lang,
      screen: evt.screen,
      vid: evt.vid,
      sid: evt.sid,
      source: evt.source,
      meta: { n: (evt.meta.events && evt.meta.events.length) || 0 },
    };
    await appendDayEvent(env, marker);
    return;
  }
  await appendDayEvent(env, evt);
}

async function appendDayEvent(env, evt) {
  const key = dayKey(new Date(evt.t));
  const raw = await env.STATS.get(key);
  let list = [];
  if (raw) {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) list = [];
  // Strip bulky fields from day stream for heat (keep x/y only)
  list.push(evt);
  if (list.length > 8000) list = list.slice(-8000);
  await env.STATS.put(key, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 120 });
}

async function appendReplay(env, evt) {
  if (!evt.sid) return;
  const key = "replay:" + evt.sid;
  const raw = await env.STATS.get(key);
  let cur = { sid: evt.sid, vid: evt.vid, start: (evt.meta && evt.meta.start) || Date.now(), events: [], meta: {} };
  if (raw) {
    try { cur = Object.assign(cur, JSON.parse(raw)); } catch { /* keep fresh */ }
  }
  const batch = (evt.meta && evt.meta.events) || [];
  cur.events = (cur.events || []).concat(batch);
  if (cur.events.length > 1800) cur.events = cur.events.slice(-1800);
  cur.vid = evt.vid || cur.vid;
  cur.meta = Object.assign({}, cur.meta, {
    path: evt.path,
    device: evt.device,
    country: evt.country,
    lang: evt.lang,
    screen: evt.screen,
    vw: evt.vw,
    vh: evt.vh,
    updated: evt.t,
  });
  if (evt.meta && evt.meta.start) cur.start = evt.meta.start;
  // ~14 days retention for replays (storage heavy)
  await env.STATS.put(key, JSON.stringify(cur), { expirationTtl: 60 * 60 * 24 * 14 });
}

async function loadRange(env, days) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400000);
    const raw = await env.STATS.get(dayKey(d));
    if (!raw) continue;
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) out.push(...list);
    } catch { /* skip */ }
  }
  return out;
}

function top(obj, n = 12) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ name: k, count: v }));
}

function aggregate(events) {
  const vids = new Set();
  const sids = new Set();
  const byDevice = { phone: 0, tablet: 0, desktop: 0 };
  const byCountry = {};
  const bySource = {};
  const byPath = {};
  const bySection = {};
  const byHourIST = Array.from({ length: 24 }, () => 0);
  const byDay = {};
  const byScreen = {};
  const byLang = {};
  const products = {};
  const ctas = {};
  const scrollDepth = { 25: 0, 50: 0, 75: 0, 100: 0 };
  const heatByPath = {};
  const sessionPaths = [];
  const landings = {};
  const exits = {};
  const sessions = {};
  let pageviews = 0;
  let timeSum = 0;
  let timeN = 0;
  let sectionTime = {};
  let bounced = 0;
  let sessionEnds = 0;
  let newVisitors = 0;
  let returningPV = 0;

  for (const e of events) {
    if (e.vid) vids.add(e.vid);
    if (e.sid) sids.add(e.sid);
    byDevice[e.device] = (byDevice[e.device] || 0) + 1;
    byCountry[e.country || "XX"] = (byCountry[e.country || "XX"] || 0) + 1;
    bySource[e.source || "other"] = (bySource[e.source || "other"] || 0) + 1;
    if (e.screen) byScreen[e.screen] = (byScreen[e.screen] || 0) + 1;
    if (e.lang) byLang[e.lang] = (byLang[e.lang] || 0) + 1;

    const t = new Date(e.t);
    const istMs = t.getTime() + (5 * 60 + 30) * 60 * 1000;
    const ist = new Date(istMs);
    byHourIST[ist.getUTCHours()]++;
    const day = ist.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;

    if (e.type === "pageview") {
      pageviews++;
      const p = e.path || "/";
      byPath[p] = (byPath[p] || 0) + 1;
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
    if (e.type === "scroll_depth" && e.meta && e.meta.depth) {
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
      if (heatByPath[hp].length < 2000) {
        heatByPath[hp].push({ x: e.meta.x, y: e.meta.y });
      }
    }
    if (e.type === "session_end") {
      sessionEnds++;
      if (e.meta && e.meta.bounced) bounced++;
      if (e.meta && e.meta.exit) exits[e.meta.exit] = (exits[e.meta.exit] || 0) + 1;
      if (e.meta && Array.isArray(e.meta.path) && e.meta.path.length) {
        sessionPaths.push({
          sid: e.sid,
          path: e.meta.path,
          duration_ms: e.meta.duration_ms || 0,
          bounced: !!e.meta.bounced,
          landing: e.meta.landing,
          exit: e.meta.exit,
          t: e.t,
          device: e.device,
          country: e.country,
        });
      }
    }

    // Build session index for replay list
    if (e.sid) {
      const s = sessions[e.sid] || {
        sid: e.sid,
        vid: e.vid,
        t: e.t,
        device: e.device,
        country: e.country,
        lang: e.lang,
        screen: e.screen,
        path: e.path,
        events: 0,
        hasReplay: false,
      };
      s.events++;
      if (e.t < s.t) s.t = e.t;
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

  const recent = [...events]
    .filter((e) => e.type !== "replay_batch" && e.type !== "click_heat")
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, 100)
    .map((e) => ({
      t: e.t,
      type: e.type,
      path: e.path,
      section: e.section,
      source: e.source,
      device: e.device,
      country: e.country,
      lang: e.lang,
      screen: e.screen,
      sid: e.sid,
      meta: e.meta || {},
    }));

  const sectionTimeList = Object.entries(sectionTime)
    .map(([name, v]) => ({
      name,
      count: v.n,
      avg_ms: v.n ? Math.round(v.ms / v.n) : 0,
    }))
    .sort((a, b) => b.avg_ms - a.avg_ms)
    .slice(0, 20);

  const sessionList = Object.values(sessions)
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, 60);

  // Cap heat points returned
  const heat = {};
  for (const [p, pts] of Object.entries(heatByPath)) {
    heat[p] = pts.slice(0, 800);
  }

  return {
    generatedAt: new Date().toISOString(),
    timezoneNote: "Hours and day buckets displayed for Asia/Calcutta (UTC+5:30)",
    totals: {
      events: events.length,
      pageviews,
      uniqueVisitorsApprox: vids.size,
      sessionsApprox: sids.size,
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
    byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
    products: top(products, 20),
    ctas: top(ctas, 20),
    scrollDepth,
    landings: top(landings, 15),
    exits: top(exits, 15),
    sectionTime: sectionTimeList,
    sessionPaths: sessionPaths.sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 40),
    sessions: sessionList,
    heat,
    recent,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true }, 200, cors);
      }

      if (url.pathname === "/collect" && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
        const items = Array.isArray(body.events) ? body.events : [body];
        let n = 0;
        for (const item of items.slice(0, 25)) {
          const evt = sanitizeEvent(item || {}, request);
          await appendEvent(env, evt);
          n++;
        }
        return json({ ok: true, n }, 200, cors);
      }

      if (url.pathname === "/admin/login" && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
        const ok = await verifyPassword(env, String(body.password || ""));
        if (!ok) return json({ error: "invalid password" }, 401, cors);
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const hours = Number(env.SESSION_HOURS || 168);
        const exp = Date.now() + hours * 3600 * 1000;
        await env.STATS.put("sess:" + token, JSON.stringify({ exp }), { expirationTtl: hours * 3600 });
        return json({ token, expiresAt: new Date(exp).toISOString() }, 200, cors);
      }

      if (url.pathname === "/admin/logout" && request.method === "POST") {
        const auth = request.headers.get("authorization") || "";
        if (auth.startsWith("Bearer ")) {
          await env.STATS.delete("sess:" + auth.slice(7).trim());
        }
        return json({ ok: true }, 200, cors);
      }

      if (url.pathname === "/admin/stats" && request.method === "GET") {
        const auth = request.headers.get("authorization") || "";
        if (!(await sessionOk(env, auth))) return json({ error: "unauthorized" }, 401, cors);
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 30)));
        const events = await loadRange(env, days);
        return json(aggregate(events), 200, cors);
      }

      if (url.pathname === "/admin/replay" && request.method === "GET") {
        const auth = request.headers.get("authorization") || "";
        if (!(await sessionOk(env, auth))) return json({ error: "unauthorized" }, 401, cors);
        const sid = String(url.searchParams.get("sid") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
        if (!sid) return json({ error: "sid required" }, 400, cors);
        const raw = await env.STATS.get("replay:" + sid);
        if (!raw) return json({ error: "not found", sid }, 404, cors);
        try {
          return json(JSON.parse(raw), 200, cors);
        } catch {
          return json({ error: "corrupt" }, 500, cors);
        }
      }

      return json({ error: "not found" }, 404, cors);
    } catch (err) {
      return json({ error: "server", message: String(err && err.message || err) }, 500, cors);
    }
  },
};
