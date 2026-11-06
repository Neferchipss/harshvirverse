// Run: node --test tests/upi-discount.test.cjs (no dependencies).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("assets/js/site.js", "utf8");
const helpers = source.slice(source.indexOf("  function runDiscountValid("), source.indexOf("  function qrSvg("));
const window = {};
vm.runInNewContext(fs.readFileSync("assets/js/harshvir-run-config.js", "utf8"), { window });
const ctx = { window, URLSearchParams, siteContent: { site: { name: "Artist" } }, inr: (v) => Number(v) || null };
vm.createContext(ctx);
vm.runInContext(helpers, ctx);
const item = { sku: "HV-BRUSH-01", price: "1000" };
const pay = { upiId: "test@upi", payeeName: "Test Artist" };
test("brush listing is 1000", () => {
 const content = JSON.parse(fs.readFileSync("content/content.json"));
 assert.equal(content.sections.find(s => s.id === "shop").items.find(i => i.sku === item.sku).price, "1000");
});
test("valid code, product restriction, invalid code and inclusive expiry", () => {
 assert.equal(ctx.runDiscountValid(" hvrun500 ", item, new Date("2026-12-05T23:59:59Z")), true);
 assert.equal(ctx.runDiscountValid("HVRUN500", item, new Date("2026-12-06T00:00:00Z")), false);
 assert.equal(ctx.runDiscountValid("OTHER", item), false);
 assert.equal(ctx.runDiscountValid("HVRUN500", { ...item, sku: "OTHER" }), false);
 assert.equal(ctx.runDiscountValid("HVRUN500", { ...item, price: "" }), false);
});
test("scan-only QR and all app links use identical discounted payment params", () => {
 const schemes = ["upi://pay", "tez://upi/pay", "phonepe://pay", "paytmmp://pay"];
 const links = schemes.map(s => ctx.upiLink(pay, item, "HVTEST", 500, "HVRUN500", s));
 for (const [i, link] of links.entries()) {
  assert.ok(link.startsWith(schemes[i] + "?"));
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("am"), "500.00");
  assert.equal(params.get("cu"), "INR");
  assert.equal(params.get("pa"), pay.upiId);
  assert.equal(params.get("tn"), "HV-BRUSH-01 HVTEST HVRUN500");
  assert.equal(link.split("?")[1], links[0].split("?")[1]);
 }
 assert.equal(new URLSearchParams(ctx.upiLink(pay, item, "HVTEST").split("?")[1]).get("am"), "1000.00");
});
test("paid form asks only UTR + email, posts JSON, never mailto", () => {
 const pf = source.slice(source.indexOf("  function paidForm("), source.indexOf("  function deliveredScreen("));
 assert.ok(!/fld\("name"/.test(pf));
 assert.ok(/fld\("utr"/.test(pf) && /fld\("email"/.test(pf));
 assert.ok(!/mailto:/.test(pf) && !/location\.href/.test(pf));
 assert.ok(/fetch\(pay\.formEndpoint/.test(pf) && /out\.ok/.test(pf));
 assert.ok(pf.includes("Get my file"));
});
test("delivery worker validates and fails without file", async () => {
 const mod = await import(require("node:path").resolve("shop-worker/src/index.js"));
 const env = { ALLOWED_ORIGINS: "https://harshvirverse.com", PRODUCTS: { get: async () => null }, EMAIL: { send: async () => { throw new Error("should not send"); } } };
 const call = (b) => mod.default.fetch(new Request("https://w/deliver", { method: "POST", headers: { Origin: "https://harshvirverse.com" }, body: JSON.stringify(b) }), env);
 assert.equal((await call({ sku: "HV-BRUSH-01", email: "a@b.co", utr: "123" })).status, 400);
 assert.equal((await call({ sku: "HV-BRUSH-01", email: "bad", utr: "123456789012" })).status, 400);
 const r = await call({ sku: "HV-BRUSH-01", email: "a@b.co", utr: "123456789012" });
 assert.equal(r.status, 503); assert.equal((await r.json()).error, "file_missing");
 let sent; env.PRODUCTS.get = async () => ({ size: 3, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer });
 env.EMAIL.send = async (m) => { sent = m; return { messageId: "x" }; }; env.OWNER_EMAIL = "o@x.com"; env.FROM_EMAIL = "d@harshvirverse.com";
 const ok = await call({ sku: "HV-BRUSH-01", email: "a@b.co", utr: "123456789012", discountCode: "HVRUN500" });
 assert.equal(ok.status, 200); assert.equal(sent.to, "a@b.co"); assert.equal(sent.bcc, "o@x.com"); assert.equal(sent.attachments.length, 1);
 assert.ok(sent.text.includes("₹500"));
});
