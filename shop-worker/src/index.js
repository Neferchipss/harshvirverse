// Asset Bay delivery Worker: POST /deliver {sku, email, utr, reference, amountPaid, discountCode}
// → emails the private R2 file to the buyer (BCC owner). GET /download?t=… serves signed links.
const PRODUCTS = {
  "HV-BRUSH-01": { title: "Photoshop Brush Pack", key: "products/HV-BRUSH-01.zip", price: 1000, codes: { HVRUN500: 500 } },
};
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]+\.[a-z]{2,}$/i;
const UTR_RE = /^\d{12}$/;
const REF_RE = /^[A-Z0-9-]{1,32}$/i;

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
async function sha256(s) { return b64url(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function toBase64(buf) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function cors(req, env) {
  const o = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim());
  return allowed.includes(o) ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}
const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: h["Access-Control-Allow-Origin"] ? 204 : 403, headers: h });
    if (url.pathname === "/download" && req.method === "GET") return download(url, env);
    if (url.pathname !== "/deliver" || req.method !== "POST") return json({ ok: false, error: "not_found" }, 404, h);
    if (!h["Access-Control-Allow-Origin"]) return json({ ok: false, error: "origin_not_allowed" }, 403, h);

    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    if (env.DELIVERY_LIMIT) {
      const { success } = await env.DELIVERY_LIMIT.limit({ key: ip });
      if (!success) return json({ ok: false, error: "rate_limited", message: "Too many tries — wait a minute and try again." }, 429, h);
    }
    let d; try { d = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, h); }
    const email = String(d.email || "").trim(), utr = String(d.utr || "").trim(), sku = String(d.sku || "").trim();
    const reference = String(d.reference || "").trim(), code = String(d.discountCode || "").trim().toUpperCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "bad_email", message: "That email doesn't look right." }, 400, h);
    if (!UTR_RE.test(utr)) return json({ ok: false, error: "bad_utr", message: "The UPI reference (UTR) is 12 digits." }, 400, h);
    if (reference && !REF_RE.test(reference)) return json({ ok: false, error: "bad_ref" }, 400, h);
    const p = PRODUCTS[sku];
    if (!p) return json({ ok: false, error: "unknown_product" }, 400, h);
    const amount = code && p.codes[code] != null ? p.codes[code] : p.price;

    if (!env.PRODUCTS || !env.EMAIL) return json({ ok: false, error: "not_configured", message: "Delivery isn't live yet." }, 503, h);
    const obj = await env.PRODUCTS.get(p.key);
    if (!obj) return json({ ok: false, error: "file_missing", message: "This pack isn't ready for delivery yet. Your payment is safe — the artist will email you." }, 503, h);

    const utrKey = "utr:" + (await sha256(utr));
    if (env.USED_UTRS && (await env.USED_UTRS.get(utrKey))) {
      await obj.body?.cancel?.();
      return json({ ok: false, error: "utr_used", message: "This UPI reference was already used. Reply to your delivery email if you need it re-sent." }, 409, h);
    }

    const filename = p.key.split("/").pop();
    const attachments = [];
    let link = "";
    if (obj.size <= Number(env.MAX_ATTACH_BYTES || 15000000)) {
      attachments.push({ content: toBase64(await obj.arrayBuffer()), filename, type: "application/zip", disposition: "attachment" });
    } else {
      await obj.body?.cancel?.();
      if (!env.LINK_SECRET) return json({ ok: false, error: "not_configured", message: "Delivery isn't live yet." }, 503, h);
      const exp = Date.now() + Number(env.LINK_HOURS || 72) * 3600e3;
      const payload = b64url(enc.encode(JSON.stringify({ k: p.key, e: exp })));
      link = `${url.origin}/download?t=${payload}.${await hmac(env.LINK_SECRET, payload)}`;
    }

    const orderLines = [`Product: ${p.title} (${sku})`, `Amount: ₹${amount}${code ? ` · code ${code}` : ""}`, `Order ref: ${reference || "-"}`, `UPI reference (UTR): ${utr}`, `Buyer: ${email}`];
    const text = `Your ${p.title} has arrived.\n\n${link ? `Download (link valid ${env.LINK_HOURS || 72} h): ${link}` : `It's attached to this email as ${filename}.`}\n\n${orderLines.join("\n")}\n\nAny trouble? Just reply to this email.\n— Harshvir, Asset Bay`;
    const html = `<div style="background:#0b0c0e;color:#eee;font-family:system-ui,sans-serif;padding:32px"><p style="color:#ffa033;letter-spacing:.2em;font-size:12px;text-transform:uppercase">Asset Bay · Delivered</p><h1 style="margin:0 0 12px">Your ${esc(p.title)} has landed.</h1><p>${link ? `<a style="color:#ffa033" href="${esc(link)}">Download your pack</a> (link valid ${esc(env.LINK_HOURS || 72)} h)` : `It's attached to this email as <b>${esc(filename)}</b>.`}</p><p style="color:#999;font-size:13px">${orderLines.map(esc).join("<br>")}</p><p>Any trouble? Just reply.<br>— Harshvir</p></div>`;
    try {
      await env.EMAIL.send({
        to: email, bcc: env.OWNER_EMAIL, replyTo: env.OWNER_EMAIL,
        from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
        subject: `Your ${p.title} — Asset Bay order ${reference || ""}`.trim(),
        text, html, attachments: attachments.length ? attachments : undefined,
      });
    } catch (e) {
      return json({ ok: false, error: "send_failed", code: e && e.code, message: "We couldn't email the file. Please try again in a minute." }, 502, h);
    }
    if (env.USED_UTRS) await env.USED_UTRS.put(utrKey, "1", { expirationTtl: 60 * 60 * 24 * 180 });
    return json({ ok: true, delivery: link ? "link" : "attachment" }, 200, h);
  },
};

async function download(url, env) {
  const [payload, sig] = String(url.searchParams.get("t") || "").split(".");
  if (!payload || !sig || !env.LINK_SECRET || sig !== (await hmac(env.LINK_SECRET, payload))) return new Response("Invalid link", { status: 403 });
  let t; try { t = JSON.parse(new TextDecoder().decode(fromB64url(payload))); } catch { return new Response("Invalid link", { status: 403 }); }
  if (!t.e || Date.now() > t.e) return new Response("This link has expired — reply to your delivery email for a fresh one.", { status: 410 });
  const obj = await env.PRODUCTS.get(t.k);
  if (!obj) return new Response("File not found", { status: 404 });
  return new Response(obj.body, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${t.k.split("/").pop()}"`, "Cache-Control": "private, no-store" } });
}
