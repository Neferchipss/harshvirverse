/**
 * harshvirverse private analytics — Cloudflare Worker
 * POST /collect          — public event ingest (CORS)
 * POST /admin/login      — password → session token
 * POST /admin/logout     — revoke session
 * GET  /admin/stats      — aggregated dashboard JSON (Bearer)
 * GET  /health           — ok
 */

const enc = new TextEncoder();

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
  const s = (ua || "").toLowerCase();
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

function sanitizeEvent(body, request) {
  const ua = request.headers.get("user-agent") || "";
  const country = (request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "XX";
  const now = new Date().toISOString();
  const type = ["pageview", "product_open", "cta_click"].includes(body.type) ? body.type : "pageview";
  const path = String(body.path || "/").slice(0, 300);
  const section = body.section != null ? String(body.section).slice(0, 80) : null;
  const hash = body.hash != null ? String(body.hash).slice(0, 120) : "";
  const ref = body.ref != null ? String(body.ref).slice(0, 500) : "";
  const utm = body.utm_source != null ? String(body.utm_source).slice(0, 80) : "";
  const vid = String(body.vid || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const sid = String(body.sid || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "";
  const lang = String(body.lang || "").slice(0, 32);
  const device = ["phone", "tablet", "desktop"].includes(body.device) ? body.device : deviceFromUa(ua);
  const meta = {};
  if (body.meta && typeof body.meta === "object") {
    for (const k of ["sku", "title", "cta", "label"]) {
      if (body.meta[k] != null) meta[k] = String(body.meta[k]).slice(0, 120);
    }
  }
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
    vid,
    sid,
    meta,
  };
}

async function appendEvent(env, evt) {
  const key = dayKey(new Date(evt.t));
  const raw = await env.STATS.get(key);
  let list = [];
  if (raw) {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) list = [];
  list.push(evt);
  // Cap ~5000 events/day to protect free KV
  if (list.length > 5000) list = list.slice(-5000);
  await env.STATS.put(key, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 120 }); // ~120 days
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

function aggregate(events) {
  const visits = events.filter((e) => e.type === "pageview").length;
  const vids = new Set(events.map((e) => e.vid).filter(Boolean));
  const byDevice = { phone: 0, tablet: 0, desktop: 0 };
  const byCountry = {};
  const bySource = {};
  const byPath = {};
  const bySection = {};
  const byHourIST = Array.from({ length: 24 }, () => 0);
  const byDay = {};
  const products = {};
  const ctas = {};
  const recent = [];

  for (const e of events) {
    byDevice[e.device] = (byDevice[e.device] || 0) + 1;
    byCountry[e.country || "XX"] = (byCountry[e.country || "XX"] || 0) + 1;
    bySource[e.source || "other"] = (bySource[e.source || "other"] || 0) + 1;
    const p = e.path || "/";
    byPath[p] = (byPath[p] || 0) + 1;
    if (e.section) bySection[e.section] = (bySection[e.section] || 0) + 1;

    // Asia/Calcutta = UTC+5:30
    const t = new Date(e.t);
    const istMs = t.getTime() + (5 * 60 + 30) * 60 * 1000;
    const ist = new Date(istMs);
    byHourIST[ist.getUTCHours()]++;
    const day = ist.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;

    if (e.type === "product_open") {
      const k = (e.meta && (e.meta.sku || e.meta.title)) || "unknown";
      products[k] = (products[k] || 0) + 1;
    }
    if (e.type === "cta_click") {
      const k = (e.meta && (e.meta.cta || e.meta.label)) || "cta";
      ctas[k] = (ctas[k] || 0) + 1;
    }
  }

  const sorted = [...events].sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 80);
  for (const e of sorted) {
    recent.push({
      t: e.t,
      type: e.type,
      path: e.path,
      section: e.section,
      source: e.source,
      device: e.device,
      country: e.country,
      meta: e.meta || {},
    });
  }

  const top = (obj, n = 12) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, count: v }));

  return {
    generatedAt: new Date().toISOString(),
    timezoneNote: "Hours and day buckets displayed for Asia/Calcutta (UTC+5:30)",
    totals: {
      events: events.length,
      pageviews: visits,
      uniqueVisitorsApprox: vids.size,
    },
    byDevice,
    byCountry: top(byCountry, 20),
    bySource: top(bySource, 20),
    byPath: top(byPath, 20),
    bySection: top(bySection, 20),
    byHourIST,
    byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
    products: top(products, 20),
    ctas: top(ctas, 20),
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
        // Accept single event or { events: [...] }
        const items = Array.isArray(body.events) ? body.events : [body];
        let n = 0;
        for (const item of items.slice(0, 20)) {
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

      return json({ error: "not found" }, 404, cors);
    } catch (err) {
      return json({ error: "server", message: String(err && err.message || err) }, 500, cors);
    }
  },
};
