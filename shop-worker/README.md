# Asset Bay delivery Worker (`harshvirverse-shop`)

Emails the bought file straight to the buyer after they enter their email + 12-digit UPI reference (UTR).
Separate from `analytics/` — analytics never stores form values. This Worker stores only SHA-256 hashes of used UTRs (to stop one UTR unlocking endless copies).

**Honest limit:** no payment gateway is used, so the Worker cannot verify the UTR with the bank. It checks format, blocks reused UTRs, rate-limits 5 req/min per IP, and BCCs the owner on every order so you can match the UTR in GPay.

## Not live yet — owner steps
1. **Enable Email Sending** for the domain: `npx wrangler email sending enable harshvirverse.com` (adds DNS records; wait until verified).
2. **Create the private bucket + KV:**
   ```
   npx wrangler r2 bucket create harshvirverse-products
   npx wrangler kv namespace create USED_UTRS   # paste id into wrangler.toml
   npx wrangler secret put LINK_SECRET          # any long random string
   ```
3. **Upload the brush pack** (never commit it to this public repo):
   `npx wrangler r2 object put harshvirverse-products/products/HV-BRUSH-01.zip --file ./HV-BRUSH-01.zip --remote`
   (or Cloudflare dashboard → R2 → harshvirverse-products → Upload, folder `products/`).
   Until this exists the API returns `503 file_missing` and the site shows an error, never a success screen.
4. **Deploy:** `cd shop-worker && npx wrangler deploy`
5. Put `https://harshvirverse-shop.<subdomain>.workers.dev/deliver` into `content/content.json` → shop `payment.formEndpoint`.

Files ≤ 15 MB are attached (Email Sending caps a message at 25 MiB incl. base64). Larger files are sent as a signed `/download` link valid `LINK_HOURS` (72 h).

New product: add it to `PRODUCTS` in `src/index.js` and upload `products/<SKU>.zip`.

## Status (6 Nov 2026)
- Deployed: `https://harshvirverse-shop.harshvirverse.workers.dev` (account 51be426a…, same as analytics).
- KV `USED_UTRS` = 8cbba665518a4a249b68eea491cfb193; KV `PRODUCT_FILES` = 2b7a439c19a940d99d799ec2e8e30262 holds `products/HV-BRUSH-01.zip` in chunks `#0..#3` (R2 isn't enabled on the account; the Worker uses R2 first if you bind it later).
- `LINK_SECRET` set as a Worker secret.
- Owner decision: file is sent automatically on any valid-format, unused UTR (no manual approval).
- **Blocked:** Email Sending requires harshvirverse.com on Cloudflare DNS. The zone isn't on Cloudflare (DNS at Hostinger), so sends fail with `E_SENDER_DOMAIN_NOT_AVAILABLE` and the site shows an error (no fake success).
  Fix: Cloudflare dashboard → Add domain harshvirverse.com (Free) → check imported DNS records incl. GitHub Pages A/CNAME + existing MX → change nameservers at Hostinger → then Compute → Email Service → Email Sending → Onboard Domain.

### Replacing the file without R2
Upload ≤25 MiB as a single KV value: `npx wrangler kv key put "products/HV-BRUSH-01.zip" --path ./HV-BRUSH-01.zip --namespace-id 2b7a439c19a940d99d799ec2e8e30262 --remote` (and delete the old `#0..#3` keys; a single key takes priority).
