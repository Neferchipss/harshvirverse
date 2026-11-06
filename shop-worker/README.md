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
