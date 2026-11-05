# Private in-site analytics (branch `analytics-private`)

Cookie-free, first-party analytics for **harshvirverse.com**. Visitor events go to a small Cloudflare Worker + KV store. The dashboard at **`/admin/stats/`** is password-protected and visible only to you — not to Neferchipss, not in Google Analytics.

Nothing here is live until you (1) merge/publish the site branch and (2) deploy the Worker and set the endpoint.

## What is tracked

| Metric | How |
| --- | --- |
| Pageviews | Auto on `index.html` / `page.html` |
| Approx. unique visitors | Random id in `localStorage` (`hv_vid`) — not a name or email |
| New vs returning | First-seen flag on that anonymous id |
| Bounce | Session end with ≤1 pageview, &lt;12s, no scroll milestones |
| Device | phone / tablet / desktop from user-agent |
| Screen band | xs / sm / md / lg / xl from viewport width |
| Browser language | `navigator.language` |
| Country | Cloudflare `request.cf.country` when Worker is live; `XX` in demo |
| Time | Stored UTC; dashboard shows **Asia/Calcutta** |
| Referrer / social | Instagram, X, LinkedIn, Google, Superhive, direct, other (+ `utm_source`) |
| Section | `?s=` / `body[data-section]` (Asset Bay, Classes, …) |
| Session path | Ordered pages + sections in the session |
| Landing & exit | First and last path of the session |
| Scroll depth | 25 / 50 / 75 / 100% milestones |
| Time on page / section | Visible time; flushed on hide / leave / heartbeat |
| Product opens | Asset Bay lightbox open (sku / title) — no layout change |
| CTA clicks | UPI open/copy, Gumroad, Gmail compose (classes / contact) |
| Click heatmaps | Aggregate click positions per path (normalized 0–1000); form fields skipped |
| Session replay | Compact mouse (throttled), clicks, scrolls, viewport, path/section markers |

**Never tracked:** keystrokes, passwords, form field values, UPI amounts, exact street-level location, long-term raw IP.

## Session replay details

- Events are compact tuples, e.g. `["m", ms, x, y]`, `["c",…]`, `["s",…]`, `["v", w, h]`, `["p", path]`.
- Mouse moves are sampled ~every 120 ms; batches flush every ~4 s (max ~80 events/batch, ~1800/session).
- Clicks on inputs/textareas are stored as masked (`x=-1`) — position of the control is not used to reconstruct typed text (and values are never read).
- Dashboard player is **schematic** (cursor + scroll over a wireframe page). There is **no DOM snapshot / rrweb video**.
- Worker stores replays under KV key `replay:{sid}` with **~14 day** TTL. Day event stream keeps a light `replay_meta` marker only.

## Storage limits / caveats

- Cloudflare **free** KV is tight on writes. Replay flushes use writes — keep traffic modest or upgrade if you grow.
- Day lists capped (~8000 events/day); replays capped (~1800 events/session).
- Demo mode (no Worker URL): everything stays in **this browser’s** `localStorage` (events + up to 12 replays). Other devices will not see it.
- Heatmaps and replay are first-party and private behind your password, but still tell visitors in the footer that analytics are used.

## Files

```
assets/js/analytics-config.js   ← set ENDPOINT after Worker deploy
assets/js/analytics.js          ← browser tracker (+ demo localStorage)
admin/stats/                    ← password-gated dashboard (heatmaps + replay player)
analytics/worker/               ← Cloudflare Worker source
```

## Review this branch without Cloudflare (demo mode)

1. Leave `HV_ANALYTICS.ENDPOINT` empty in `assets/js/analytics-config.js` (default).
2. Serve the site locally, e.g. from the repo root:
   ```bash
   python3 -m http.server 8765
   ```
3. Browse `http://127.0.0.1:8765/` — scroll, open Asset Bay, click around for ~15–20 seconds.
4. Open `http://127.0.0.1:8765/admin/stats/`
5. Password: **`change-me-hv-stats`** (placeholder — change before go-live).
6. Check new panels: scroll depth, landings/exits, session paths, heatmap, session list → **Play** replay.
7. Tip: open the home page in one tab, stats in another; use Refresh after moving the mouse on the site. Leave the site tab (or wait for heartbeat) so `session_end` / time metrics appear.

## Deploy Cloudflare Worker (required for real multi-visitor stats)

> **Status:** The Worker is already deployed to `https://harshvirverse-analytics.harshvirverse.workers.dev` on Harshvir's Cloudflare account (KV `STATS` id `c4cb4f3c97514347bfe657ac7c204677`, preview `fc8c4596a17046fe8ac1a2dd23c6090b`). `assets/js/analytics-config.js` already points at it. The steps below are for redeploying or rotating the password.

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

Admin API extras:

- `GET /admin/stats?days=30` — aggregates (Bearer)
- `GET /admin/replay?sid=…` — compact replay JSON (Bearer)

## Security notes

- Never commit a real plaintext password.
- The GitHub repo (Neferchipss) can see the public Worker URL and the JS, but **cannot** read KV or the dashboard without your password.
- Rotate the password by updating `ADMIN_PASSWORD_HASH` and redeploying.
- Optional hardening later: Custom domain route, Cloudflare Access in front of `/admin/stats/`, or CAPTCHA on `/collect`.

## Publishing policy

This work ships on branch **`analytics-private` only**. Do **not** merge to `main` / publish GitHub Pages until Harshvir explicitly approves.
