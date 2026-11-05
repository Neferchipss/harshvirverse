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
