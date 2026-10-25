# harshvirverse.com — v2 changes (branch `v2`, not published until merged into `main`)

The architecture is unchanged: `index.html` + `page.html` render everything from
`content/content.json` through `assets/js/site.js`, and the admin panel (`/admin/`)
still edits and publishes that same file. This branch is not live: GitHub Pages publishes from `main`.

## 1. Landing page: cursor-follow lag (assets/js/site.js → `rigHero`)
- Frames are converted to `ImageBitmap` once, off the main thread, so moving the
  mouse never makes the browser decode an image mid-animation.
- Removed layout reads from the 60 fps loop: the old loop called
  `rail.matches(":hover")` and `rail.getBoundingClientRect()` twice per frame.
  The rail's position is now measured on resize only, and hover is tracked with
  pointerenter/pointerleave.
- DOM writes (axis width, arrow position, eye-line height, readout text) only
  happen when the value actually changes. The arrow moves with `translate3d`.
- Smoother, quicker follow: frame-rate-independent exponential easing
  (`1 - e^(-16·dt)`) and a 1.6× higher travel-speed cap. The head reaches the
  cursor sooner without jumping.
- The canvas context is created with `alpha: false` (opaque, cheaper to composite).
  Mirrored backdrop strips use `setTransform` instead of `save()`/`restore()`.
- The loop does nothing while the tab is hidden.
- Progressive loading: 16 key frames spread across the head turn load first and
  end the loading screen. The remaining frames stream in afterwards
  (`requestIdleCallback`), so the visitor no longer waits for all 62.
- Optimised frame set: `assets/hero/sweep-2-1080-q70/` holds the same 62 frames
  re-encoded as WebP q70 (4.50 MB vs 5.25 MB). The originals are untouched, and
  the 1440p set (`sweep-2/`) is still used on tall/HiDPI screens.
  New content.json keys: `hero.rig.pathFast`, `hero.rig.keyFrames`.
- Bug: the old code requested `f_062.webp`, which doesn't exist (a 404 on the live
  site). The frame range is now clamped to the 62 real frames.

## 2. Mouse arrow restored
- Removed `.home.rig, .home.rig * { cursor: none; }`: the normal arrow is visible everywhere.
- Removed the trailing red dot that replaced the arrow on the landing page. It was
  drawn with a lerp, so it lagged behind the real pointer.
- Inner pages keep the ring effect as an overlay *around* the arrow. It now sits
  exactly on the pointer (rAF-batched, no trailing) and stays hidden until the
  mouse moves. It is still off on touch screens and with reduced motion.

## 3. Content bugs
- Universities: removed the empty 8th entry (it showed a blank "08" row).
  The counter now reads 7 institutions.
- Workshops and Projects: the "Workshop title / Institution / Date" and
  "Project title" placeholders are marked `"draft": "yes"` and hidden.
  An empty page shows its heading and invitation CTA only.
- New generic rule: entries with no title, or `draft: yes`, are never rendered.
  The admin has a "Hidden draft?" field for this.
- Shop menu label "Shop for Artist|Creators" (id `new-section`) is now
  "Asset Bay" (id `shop`). Old links `page.html?s=new-section` still work (alias).
- The draft-like brush pack description (which said the painting "reads a bit
  blobby", the harness is "muddy", etc.) was replaced with neutral copy built only
  from facts already on the page.

## 4. Navigation & accessibility
- Hovering the side menu reveals every label at once, so the icons can be scanned.
  The hovered item is fully bright.
- Visible keyboard focus ring on menu links, filter buttons, buy/copy buttons and the hero CTA.
- Alt text: university logos ("<name> logo"), product previews, the hero image,
  and a labelled landing canvas (`role="img"`). Decorative rig axis/arrow are `aria-hidden`.
- "HW" monogram has `aria-label="Home"`.

## 5. Performance (other)
- Two PNG screenshots used as campus/logo images were converted to WebP:
  2.01 MB → 128 KB and 2.55 MB → 169 KB. content.json now points to the .webp
  files; the PNGs are kept.
- Preloads the first hero poster frame.

## 6. SEO & sharing
- Descriptive `<title>`, canonical URL, Open Graph + Twitter card tags, and a
  1200×630 share image (`assets/og-image.jpg`, built from the existing hero frame).
- Favicons: `assets/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`.
- JSON-LD `Person` structured data (name, URL, email, Mumbai, languages, Vimeo)
  using only facts already on the site.
- `<noscript>` fallback with name, tagline, section links and email (the page was empty without JS).
- Each inner page sets its meta description from the section intro.
- New `robots.txt` (blocks /admin/) and `sitemap.xml`.

## 7. New: "Asset Bay" shop (layout `shop`)
- Landing CTA "Enter Asset Bay →" under the name.
- Shop link sits second in the side menu (right after Home), with an orange dot.
- Category filters: All / 3D Assets / Blender Add-ons / Photoshop Brushes / Other, with counts.
- Product cards from content.json, styled as render tiles with the loader's orange
  corner brackets on hover. Fields: title, sku, category, pitch, includes, formats,
  compatibility, licence, price (INR), image + images, optional gumroad link, draft.
  Empty fields (or ones containing "TODO") are hidden on the site.
- Product window: gallery, description and specs, then checkout:
  - **Primary (desktop):** UPI QR code generated in the browser (vendored
    `assets/js/vendor/qrcode.js`, MIT, Kazuhiko Arase) with the amount and a
    payment note (product code + a short order reference). Shows the UPI ID with a Copy button.
  - **Secondary:** an "Open in UPI app" link (`upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…`).
  - **Step 2, "I've paid":** a form for name, email and the 12-digit UTR. It posts
    JSON to `payment.formEndpoint` (Formspree-style). While that is empty,
    the order opens as a pre-filled email to the site email instead.
  - With no price set, no price is shown and the buyer enters the amount in their UPI app. Checkout only reads "Coming soon" if no UPI ID is set.
- A "how it works" strip: Pick → Pay → Send the UTR → Download.
- Admin: new "shop" page style with UPI settings (UPI ID, payee name, form
  endpoint, delivery note) and product fields (category dropdown, price, formats…).

## Owner decisions applied (26 Oct 2026)
- Shop name: **Asset Bay** (CTA "Enter Asset Bay →", menu, page title, meta).
- UPI ID `harshvirwankhede-1@oksbi`, payee Harshvir Wankhade. QR encodes
  `upi://pay?pa=harshvirwankhede-1@oksbi&pn=Harshvir%20Wankhade&cu=INR&tn=<sku> <ref>`.
- No prices yet: nothing price-related is shown, and the QR/link carry no `am=`, so the
  buyer types the amount ("Scan with any UPI app and enter the amount. Questions? Get in touch").
  When a price is added in admin, it shows and fills the amount automatically.
- Only the existing brush pack is listed; categories with no products are hidden.
  Unknown brush-pack fields (includes, formats, compatibility, licence, price) are left empty and hidden.
- Experience: 11+ everywhere. The Industry intro now says "11+ years", and the counter uses the new
  optional section field `years` (admin: "Timeline: years of experience shown").

## Still open
- `payment.formEndpoint` is empty. Until a Formspree/Google Form URL is set, "Send for delivery"
  opens a pre-filled email to the site email.
- "Since 2023" on Universities is computed from the listed dates.
- Showcase painting disclosure (previously described as code-generated): owner's call.

## Not changed (flagged)
- `protectMedia()` still blocks right-click and Ctrl+S on media.
- Mobile layout: out of scope (the site is designed for laptop/desktop).

## Measured (local, 1440×900 @2x, CPU 4× slower, 10 Mbps, mouse sweeps; avg of 2 runs)
| | Before | After |
|---|---|---|
| Time until landing opens | 6.6 s | 2.6 s |
| Downloaded before it opens | 7.45 MB | 2.7 MB |
| FPS while moving the mouse | 17 | 33 |
| Avg / p95 frame time | 58 / 167 ms | 31 / 58 ms |
| Frames over 33 ms | 56% | 27% |
| Long tasks (main thread blocked) | 17.6 s | 0 s |
| Console errors | 404 + script error | none |
Raw data: /workspace/perf/before2.json, /workspace/perf/after.json
