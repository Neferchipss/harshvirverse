# v4.1 — crash fix ("A problem repeatedly occurred" in Safari on refresh)

The v4 home page used too much memory, so Safari killed the tab, mostly after a refresh.
- **Hero frames:** on retina Macs the site picked the 1440p frame set and kept all 62 frames decoded as ImageBitmaps, which is about 780 MB. Now it always uses the 1080p set and keeps the frames compressed (Blobs). Only a window of the 24 most recently used frames around the cursor is decoded, and an evicted bitmap is `close()`d.
- **Canvas size:** the hero canvas is capped at 1.5× DPR instead of 2×. The frames are only 1080 px tall.
- **Leaving the page (`pagehide`):** every bitmap and the rim sprite is closed, every canvas is shrunk to 0×0, the AudioContext is closed and all animation loops stop. Three.js renderers are disposed and their GL contexts released (`forceContextLoss`). A page restored from the back/forward cache reloads.
- **WebGL:**
  - A lost context stops drawing instead of erroring.
  - Renderer creation is guarded, so the 3D object is skipped when WebGL is unavailable.
  - The object's DPR is capped at 1.5 and the workspace's at 1.25, with no antialiasing.
  - The workspace scene runs one loop, and only while it is on screen.
  - It is skipped on devices that report 4 GB of memory or less.
- **Opening with "Reduce motion" / Windows "Animation effects" off:** the pixel-to-photo opening used to be skipped completely. Its canvas was removed under `prefers-reduced-motion: reduce`. It now plays a short, gentle version: 1 s, no noise, no wireframe, no head turn. The full opening also waits until the hero has painted a real frame, and it still starts if the loader is already finishing when fx.js attaches.
- **Render settings:** plain F12 now toggles the panel as well as R and ? (DevTools shortcuts with modifiers are untouched). A small status-bar style hint, "Press R or F12 for render settings", appears bottom-right of the hero after the opening, and clicking it opens the panel.

# harshvirverse.com — v4 "wow" (branch `v4-wow`, built on `v3-redesign`, not published)

Everything from v2 and v3 is kept. That includes Asset Bay, the UPI QR at harshvirwankhede-1@oksbi with no amount and no prices, empty categories hidden, 11+ years, the `content/content.json` and `/admin/` setup, and the desktop-only target.
The new effects live in two new files, `assets/js/fx.js` and `assets/css/v4.css`. They hook into `site.js` through small hooks: `window.hvRig`, the `hv:rig`, `hv:booted` and `hv:ready` events, `window.hvWipe` and `window.hvPull`.

## Landing
- **Cinematic opening:**
  - after the Cycles tile loader, the head is shown as a wireframe made from an edge map of the real frame
  - it then "renders": coarse noisy samples sharpen to the clean photo, with a "Sample n/128" readout
  - meanwhile the head turns to face the visitor
- **Cursor light (2D, honestly faked):** the portrait is a sequence of photos, not a 3D model, so there is no real relighting. Two parts make up the effect:
  - a low-resolution radial falloff (a warm core fading into shadow) that follows the pointer
  - a warm rim glow taken from `assets/hero/rim-edges.webp`, a precomputed edge sprite of every second frame (177 KB, loaded when the browser is idle). It is drawn only in a small window around the cursor.
  - With no mouse, the light slowly orbits. With reduced motion, it stays fixed.
- **3D extruded name:** it uses stacked text shadows, tilts toward the light, and has a sheen that follows the light.
- **Scroll pullback:**
  - the hero viewport tilts back and shrinks into a Blender-style 3D workspace
  - a Three.js grid and axes, with floating wireframe teapot, bulb, gear, rocket, plane, university and easel
  - panels fly in:
    - an Outliner that mirrors the nav, with item counts
    - Object Properties: Name, Location, 11+ years, 7 institutions, 4 studios
    - an industry timeline built from the existing studio data
    - a tool strip
  - a camera frame label
- **Count-up stats.**

## Everywhere
- **Wireframe to final reveal** on portfolio and work thumbnails: an edge-map overlay wipes away behind an orange scan line.
- **Magnetic buttons.**
- **"Switching viewport" wipe** on internal page changes.
- **Hover sounds:** made with WebAudio, OFF by default. Toggle them with the speaker button in the header or in the render panel; the choice is saved in localStorage.
- **Asset Bay turntable** on the home page and in the shop:
  - the painting and 5 breakdown crops sit on a carousel you can drag to rotate, with inertia
  - it auto-rotates and pauses when off screen
  - a drag does not trigger a click
- **Easter egg: press R (or ?)** for a Render Properties panel:
  - engine: Cycles, EEVEE (adds a soft-light key bloom) or Workbench
  - viewport shading: Wireframe (live line art of the head), Solid or Rendered
  - samples: below 128 adds grain
  - light power and colour (warm, cool or white)
  - hover sounds
  - Render Image replays the opening
  - Reset
  - Esc closes the panel

## Performance and accessibility
- Heavy work waits until the loader finishes and the first paint:
  - the rim sprite loads when the browser is idle
  - Three.js for the workspace is imported on the first scroll
- Animation loops pause when the tab is hidden or the effect is off screen.
- No per-frame GPU readback:
  - edge maps are computed once per frame change at low resolution
  - the rim sprite is converted in a Worker
- There are no blend-mode layers by default (soft-light only in EEVEE, grain only below 128 samples).
- `prefers-reduced-motion` gets a calm version:
  - no opening and a fixed light
  - no pullback transform (`.pull.calm`)
  - no wipes, magnets or count-ups
  - the institutions strip stays on one static line
- Measured with the same method as v3: local, 1440×900, CPU 4× slower, mouse sweeps, back-to-back, 2 runs each.

  | Version | fps | Frames >33 ms | Long tasks | Boot | Bytes before boot |
  |---|---|---|---|---|---|
  | live | ~20 | 54% | ~15.7 s | ~6.6 s | 7.45 MB |
  | v3 | ~34 | 22–35% | 0–0.1 s | ~2.67 s | 2.73 MB |
  | v4 | ~30 | ~42% | 0 | ~2.81 s | 2.96 MB |

  The headless software-GL test browser penalises full-screen overlays; real GPUs are much less affected.

---

# harshvirverse.com — v3 "fresh redesign" (branch `v3-redesign`, built on `v2`, not published)

Everything from v2 is kept: Asset Bay, the UPI QR at harshvirwankhede-1@oksbi with no amount and no price shown, empty shop categories hidden, and 11+ years.
The site is still driven by `content/content.json` and edited in `/admin/`. GitHub Pages publishes only from `main`, so none of this is live.

## Look and feel
- New design system in `assets/css/v3.css`, loaded after `site.css`:
  - colour, type-scale, spacing, radius and easing tokens
  - one accent colour everywhere: Blender orange `#ff7a1a`. The old red is gone, including on the 3D wireframes in `objects.js`.
- Labelled top navigation styled like Blender's header bar, replacing the icon-only rail:
  - the name and logo go home
  - text links come from each section's "Menu label" in the admin
  - an underline marks the active page, and a dot marks Asset Bay
  - a "Contact" button sits on the right
  - Order: Portfolio, Asset Bay and 1:1 Classes first. Pages whose entries are all still drafts go last.
- New footer with the same links, location and socials.
- Smooth page changes through cross-document View Transitions, plus the existing fade.
- Hover and press micro-interactions on buttons, cards and nav.
- All motion is off under `prefers-reduced-motion`.

## Landing page
- The rigged head that follows the cursor and the Cycles-style tile loader are unchanged.
  The 3D viewport now sits under the header bar, the way Blender's viewport sits under its header.
- A right-hand panel holds:
  - the roles label and the name as a Blender text object
  - a short intro (new optional admin field "Short intro under the name")
  - four buttons: View work, Enter Asset Bay, Book a 1:1 class, Workshops. They are set in the new admin field "Landing buttons", one per line as `Label | link`.
- Credibility strip along the bottom, styled like Blender's timeline. It is computed only from existing content:
  - 11+ years in production (from Industry → years)
  - institutions taught at (count of Universities entries)
  - studios and companies (count of Industry entries)
  - a scrolling list of all those names
- The landing now scrolls, with these sections below the first screen:
  - Selected work: the first 3 Portfolio entries
  - Asset Bay: the products
  - 1:1 Classes: the formats, plus the software taught
  - a contact band
- The rig stops drawing while it is scrolled out of view.
- Images below the fold load only after the boot render finishes, or on the first scroll.
- The axis and handle overlays live inside the stage, so they scroll with it.

## Portfolio and Asset Bay
- Portfolio entries are video cards. Hovering one for about half a second plays a muted inline preview of the real Vimeo/YouTube video, and moving away removes it. Clicking opens the full player in the lightbox.
- Previews are off on touch screens and when reduced motion is set.
- Asset Bay cards are restyled. A shop with a single product shows it as one wide card.

## Performance
Measured at 1440x900, DPR 2, CPU ×4 and 10 Mbps, averaging 2 runs:

| Version | Boot | Before open | FPS | Frames >33 ms | Long tasks |
|---|---|---|---|---|---|
| v3 | ~2.70 s | 2.73 MB | ~37 | ~23% | 0 |
| v2 | ~2.65 s | 2.70 MB | ~37 | ~25% | 0 |
| Live | 6.6 s | 7.45 MB | 17 | — | — |


---

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
