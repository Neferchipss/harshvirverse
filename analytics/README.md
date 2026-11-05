# Private in-site analytics (branch `analytics-private`)

Cookie-free, first-party analytics for **harshvirverse.com**. Visitor events go to a small Cloudflare Worker + KV store. The dashboard at **`/admin/stats/`** is password-protected and visible only to you — not to Neferchipss, not in Google Analytics.

Nothing here is live until you (1) merge/publish the site branch and (2) deploy the Worker and set the endpoint.

## What is tracked

| Metric | How |
| --- | --- |
| Pageviews | Auto on `index.html` / `page.html` |
| Approx. unique visitors | Random id in `localStorage` (`hv_vid`) — not a name or email |
| Device | phone / tablet / desktop from user-agent |
| Country | Cloudflare `request.cf.country` when Worker is live; `XX` in demo |
| Time | Stored UTC; dashboard shows **Asia/Calcutta** |
| Referrer / social | Instagram, X, LinkedIn, Google, Superhive, direct, other (+ `utm_source`) |
| Section | `?s=` query (Asset Bay, Classes, …) |
| Product opens | Asset Bay lightbox open (sku / title) — no layout change |
| CTA clicks | UPI open/copy, Gumroad, Gmail compose (classes / contact) |

Not tracked: passwords, UPI amounts, form field values, exact IP (Worker may see IP transiently; we do not store it).

## Files

```
assets/js/analytics-config.js   ← set ENDPOINT after Worker deploy
assets/js/analytics.js          ← browser tracker (+ demo localStorage)
admin/stats/                    ← password-gated dashboard UI
analytics/worker/               ← Cloudflare Worker source
```

## Review this branch without Cloudflare (demo mode)

1. Leave `HV_ANALYTICS.ENDPOINT` empty in `assets/js/analytics-config.js` (default).
2. Serve the site locally, e.g. from the repo root:
   ```bash
   python3 -m http.server 8765
   ```
3. Browse `http://127.0.0.1:8765/` and open a few pages / Asset Bay products.
4. Open `http://127.0.0.1:8765/admin/stats/`
5. Password: **`change-me-hv-stats`** (placeholder — change before go-live).

Demo data lives only in **that browser’s** `localStorage`. Other devices will not see it.

## Deploy Cloudflare Worker (required for real multi-visitor stats)

You need a free [Cloudflare](https://dash.cloudflare.com/) account. DNS for harshvirverse.com can stay on Hostinger — the Worker can live on `*.workers.dev`.

### 1. Install Wrangler and log in

```bash
npm i -g wrangler
wrangler login
```

### 2. Create KV namespace

```bash
cd analytics/worker
wrangler kv namespace create STATS
wrangler kv namespace create STATS --preview
```

Paste the returned ids into `wrangler.toml` (`id` and `preview_id`).

### 3. Set your own password hash

**Do not keep the placeholder password in production.**

```bash
# pick a strong password, then:
python3 - <<'PY'
import hashlib
salt = "hv-analytics-v1"          # must match ADMIN_SALT in wrangler.toml
password = input("Password: ").strip()
print(hashlib.sha256(f"{salt}:{password}".encode()).hexdigest())
PY
```

Put the hex into `wrangler.toml` → `ADMIN_PASSWORD_HASH`, or better:

```bash
wrangler secret put ADMIN_PASSWORD_HASH
# (paste the hex when prompted)
```

If you use a secret, remove `ADMIN_PASSWORD_HASH` from `[vars]` so the secret wins.

### 4. Allow your site origin

`ALLOWED_ORIGINS` in `wrangler.toml` already includes `https://harshvirverse.com`. Add preview origins if needed.

### 5. Deploy

```bash
wrangler deploy
```

Copy the URL, e.g. `https://harshvirverse-analytics.<subdomain>.workers.dev`.

### 6. Point the site at the Worker

Edit `assets/js/analytics-config.js`:

```js
window.HV_ANALYTICS = {
  ENDPOINT: "https://harshvirverse-analytics.<subdomain>.workers.dev",
  DEMO_PASSWORD: "change-me-hv-stats", // unused once ENDPOINT is set
};
```

Commit that change on this branch (or after you approve publish), then publish the site when you are ready.

### 7. Open the dashboard

`https://harshvirverse.com/admin/stats/` → your new password.

## Security notes

- Never commit a real plaintext password.
- The GitHub repo (Neferchipss) can see the public Worker URL and the JS, but **cannot** read KV or the dashboard without your password.
- Rotate the password by updating `ADMIN_PASSWORD_HASH` and redeploying.
- Optional hardening later: Custom domain route, Cloudflare Access in front of `/admin/stats/`, or CAPTCHA on `/collect`.

## Publishing policy

This work ships on branch **`analytics-private` only**. Do **not** merge to `main` / publish GitHub Pages until Harshvir explicitly approves.
