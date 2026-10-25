(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const csv = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  // An entry's pictures: the main image (or campus photo on showcase pages) plus its "More pictures"
  const pics = (it, first = it.image) => [first, ...(it.images || [])].filter(Boolean);
  // v2: entries with no title, or marked as a draft in the admin, are never shown
  const isDraft = (it) => it.draft === true || /^(yes|true)$/i.test(String(it.draft || ""));
  const visible = (items) => (items || []).filter((it) => it && String(it.title || "").trim() && !isDraft(it));
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const isHome = document.body.classList.contains("home");
  // v2: old shop URL (?s=new-section) keeps working
  const ALIASES = { "new-section": "shop" };
  const current = isHome ? "home" : ALIASES[params.get("s")] || params.get("s") || "";
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; }, { passive: true });

  // Keep ?preview=1 on internal links so the admin draft follows you around
  const href = (url) => {
    if (!preview || /^(https?:|mailto:|tel:|#)/.test(url)) return url;
    return url + (url.includes("?") ? "&" : "?") + "preview=1";
  };
  const pageUrl = (id) => href(`page.html?s=${encodeURIComponent(id)}`);
  const external = (a, url) => { a.href = url; a.target = "_blank"; a.rel = "noopener"; };

  async function loadContent() {
    if (preview) {
      try {
        const draft = localStorage.getItem("hv-draft");
        if (draft) return JSON.parse(draft);
      } catch (_) {}
    }
    const res = await fetch("content/content.json?v=" + Date.now());
    return res.json();
  }

  function renderShared(c) {
    $$("[data-bind]").forEach((n) => { n.textContent = get(c, n.dataset.bind) ?? ""; });
    $$(".mark").forEach((a) => { a.href = href("./"); });
    $('meta[name="description"]').content = c.site.metaDescription || "";

    const links = [
      { id: "home", label: "Home", icon: "home", url: href("./") },
      // v2: the shop sits right after Home; sections marked as drafts stay out of the menu
      ...[...c.sections].filter((s) => !isDraft(s)).sort((a, b) => (b.layout === "shop") - (a.layout === "shop"))
        .map((s) => ({ id: s.id, label: s.nav || s.title, icon: s.icon, url: pageUrl(s.id), shop: s.layout === "shop" })),
      { id: "contact", label: "Contact", icon: "send", url: pageUrl("contact") },
    ];
    // v3: labelled top navigation. Order: Work and Asset Bay first, the rest as in the admin,
    // Contact as the button on the right. Home is the name/logo on the left.
    const PRIORITY = ["grid", "shop", "builder"];
    const rank = (l) => {
      const s = c.sections.find((x) => x.id === l.id);
      if (!s) return 99;
      const i = PRIORITY.indexOf(s.layout);
      // pages that only show a heading (every entry still a draft) go to the end
      return (i < 0 ? 9 : i) + (visible(s.items).length || s.layout === "builder" || s.layout === "shop" ? 0 : 50);
    };
    const navLinks = links.filter((l) => l.id !== "home" && l.id !== "contact")
      .map((l, i) => ({ ...l, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i);
    const nav = $("#rail");
    nav.className = "nav";
    const mk = (l, cls) => {
      const a = el("a", [cls, l.id === current ? "active" : "", l.shop ? "shop-link" : ""].filter(Boolean).join(" "));
      a.href = l.url;
      if (l.id === current) a.setAttribute("aria-current", "page");
      a.append(el("span", "", l.label));
      return a;
    };
    nav.replaceChildren(...navLinks.map((l) => mk(l, "nav-link")));
    const bar = $(".topbar");
    if (bar) {
      const brand = $(".brand", bar);
      if (brand) {
        brand.href = href("./");
        brand.replaceChildren(el("b", "", c.site.initials || "HW"), el("span", "", c.site.name || ""));
        if (current === "home") brand.setAttribute("aria-current", "page");
      }
      const cta = $(".nav-cta", bar);
      if (cta) { cta.href = pageUrl("contact"); cta.classList.toggle("active", current === "contact"); cta.firstChild.textContent = "Contact"; }
      // the bar gets a solid backdrop once the page scrolls
      const onScroll = () => bar.classList.toggle("scrolled", scrollY > 24);
      addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    // footer navigation (same links, as text)
    const fnav = $("#footer-nav");
    if (fnav) fnav.replaceChildren(...[links[0], ...navLinks, links[links.length - 1]].map((l) => { const a = el("a", "", l.label); a.href = l.url; return a; }));

    const socials = $("#socials");
    if (socials) {
      socials.replaceChildren(...(c.site.socials || []).filter((s) => s.url).map((s) => {
        const a = el("a", "", s.label);
        external(a, s.url);
        return a;
      }));
    }
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* =========================================================
     Landing
     ========================================================= */
  function renderHome(c) {
    // v2: keep the descriptive <title> from index.html (better for search results)
    if (!document.title) document.title = [c.hero.headlineTop, c.hero.headlineBottom].filter(Boolean).join(" ") || c.site.name;
    // "A × B × C" — separators get the accent colour
    const tag = $("#tagline");
    (c.hero.tagline || "").split(/\s*×\s*/).filter(Boolean).forEach((part, i) => {
      if (i) tag.append(el("span", "x", "×"));
      tag.append(el("span", "", part));
    });
    heroMedia(c.hero);
    const cap = $(".stage-caption");
    if (c.hero.intro) cap.append(el("p", "hero-intro", c.hero.intro));
    // v3: landing buttons ("Label | link" per line in the admin); v2's single ctaLabel still works
    const shopSec = c.sections.find((x) => x.layout === "shop" && !isDraft(x));
    let ctas = (c.hero.ctas || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([l, u]) => l && u);
    if (!ctas.length && (c.hero.ctaLabel || shopSec)) ctas = [[c.hero.ctaLabel || `Enter ${shopSec.nav || shopSec.title}`, c.hero.ctaHref || `page.html?s=${shopSec.id}`]];
    if (ctas.length) {
      const row = el("div", "hero-ctas");
      ctas.forEach(([label, url], i) => {
        const a = el("a", i ? "btn ghost" : "btn primary", label);
        a.append(el("span", "arrow", "→"));
        ctaHref(a, url);
        row.append(a);
      });
      cap.append(row);
    }
    homeSections(c);
  }

  /* v3: below the first screen — credibility strip, selected work, Asset Bay,
     1:1 classes, and a contact band. Everything is read from the existing
     sections, so the admin keeps editing it. */
  function homeSections(c) {
    const root = $("#home-more");
    if (!root) return;
    const sec = (id) => c.sections.find((x) => x.id === id && !isDraft(x));
    const byLayout = (l) => c.sections.find((x) => x.layout === l && !isDraft(x));
    const out = [];

    // credibility strip
    const uni = byLayout("showcase"), ind = byLayout("timeline");
    const uniItems = uni ? visible(uni.items) : [], indItems = ind ? visible(ind.items) : [];
    const yrs = ind ? Number(ind.years) || null : null;
    const cred = el("section", "cred");
    cred.setAttribute("aria-label", "At a glance");
    const nums = el("div", "cred-nums");
    [[yrs, "Years in production", true, ind], [uniItems.length || null, "Institutions taught at", false, uni], [indItems.length || null, "Studios & companies", false, ind]]
      .forEach(([v, label, plus, s]) => {
        if (!v) return;
        const a = el("a", "cred-num");
        a.href = pageUrl(s.id);
        const b = el("b", "", String(v));
        if (plus) b.append(el("sup", "", "+"));
        a.append(b, el("span", "", label));
        nums.append(a);
      });
    const names = [...uniItems.map((x) => x.title), ...indItems.map((x) => x.title)];
    cred.append(nums);
    if (names.length) {
      const m = el("div", "cred-names");
      m.setAttribute("aria-label", names.join(", "));
      const track = el("div", "cred-track");
      track.setAttribute("aria-hidden", "true");
      [...names, ...names].forEach((n) => track.append(el("span", "", n)));
      m.append(track);
      cred.append(m);
    }
    // the strip sits along the bottom of the first screen, like Blender's timeline
    $("#stage").append(cred);

    const block = (s, kicker, title, more) => {
      const b = el("section", "home-block");
      const hd = el("div", "home-block-head reveal");
      const left = el("div");
      left.append(el("p", "eyebrow", kicker), el("h2", "", title));
      hd.append(left);
      if (more) { const a = el("a", "link-cta", more); a.href = pageUrl(s.id); hd.append(a); }
      b.append(hd);
      return b;
    };

    // selected work
    const work = byLayout("grid");
    const workItems = work ? visible(work.items).slice(0, 3) : [];
    if (workItems.length) {
      const b = block(work, work.eyebrow || work.nav, work.title, `All ${String(work.nav || "work").toLowerCase()}`);
      const g = el("div", "work-cards");
      workItems.forEach((it, i) => g.append(workCard(it, i)));
      b.append(g);
      out.push(b);
    }

    // Asset Bay
    const shopS = byLayout("shop");
    const prods = shopS ? visible(shopS.items) : [];
    if (shopS && prods.length) {
      const b = block(shopS, shopS.eyebrow || "Shop", shopS.title, `Enter ${shopS.nav || shopS.title}`);
      const row = el("div", "bay-row");
      const intro = el("p", "bay-intro reveal", shopS.intro || "");
      row.append(intro);
      prods.slice(0, 2).forEach((it) => {
        const a = el("a", "bay-card reveal");
        a.href = pageUrl(shopS.id);
        const m = el("div", "bay-media");
        const src = pics(it)[0];
        if (src) { const img = el("img"); img.alt = `${it.title} — preview`; later(img, src); m.append(img); }
        const body = el("div", "bay-body");
        body.append(el("span", "chip", it.category || "Other"), el("h3", "", it.title));
        if (it.pitch) body.append(el("p", "", it.pitch));
        body.append(el("span", "bay-go", "Pay by UPI · view →"));
        a.append(m, body);
        row.append(a);
      });
      b.append(row);
      out.push(b);
    }

    // 1:1 classes
    const cls = byLayout("builder");
    const fmts = cls ? visible(cls.items) : [];
    if (fmts.length) {
      const b = block(cls, cls.eyebrow || cls.nav, cls.title, cls.nav ? `Book ${cls.nav}` : "Book a session");
      const g = el("div", "class-cards");
      fmts.forEach((it, i) => {
        const a = el("a", "class-card reveal");
        a.href = pageUrl(cls.id);
        a.append(el("span", "class-no", String(i + 1).padStart(2, "0")), el("h3", "", it.title));
        const meta = [it.subtitle, it.meta].filter(Boolean).join(" · ");
        if (meta) a.append(el("span", "class-meta", meta));
        if (it.description) a.append(el("p", "", it.description));
        g.append(a);
      });
      b.append(g);
      if (cls.tools) {
        const t = el("p", "class-tools reveal");
        t.append(el("span", "", "Software"), document.createTextNode(csv(cls.tools).join(" · ")));
        b.append(t);
      }
      out.push(b);
    }

    // contact band
    const k = c.contact || {};
    const band = el("section", "contact-band reveal");
    const l = el("div");
    l.append(el("p", "eyebrow", k.eyebrow || "Contact"), el("h2", "", k.title || "Get in touch"));
    if (k.text) l.append(el("p", "muted", k.text));
    const r = el("div", "contact-band-actions");
    const go = el("a", "btn primary", "Start a conversation");
    go.append(el("span", "arrow", "→"));
    go.href = pageUrl("contact");
    r.append(go);
    const mail = k.email || c.site.email;
    if (mail) { const m = el("a", "contact-mail", mail); m.href = "mailto:" + mail; r.append(m); }
    const card = el("div", "contact-card");
    card.append(l, r);
    band.append(card);
    out.push(band);

    root.replaceChildren(...out);
  }

  // v3: landing images below the first screen load only when they're about to scroll
  // into view, so they never compete with the rig frames during the boot render
  const laterIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.src = e.target.dataset.src; laterIO.unobserve(e.target); }
  }), { rootMargin: "400px 0px" }) : null;
  // start watching on the first scroll, or a moment after the boot render has finished
  let laterOn = false;
  const laterQ = [];
  const startLater = () => { if (laterOn) return; laterOn = true; laterQ.forEach((i) => laterIO.observe(i)); };
  const later = (img, src) => {
    img.decoding = "async";
    if (!laterIO) { img.src = src; return; }
    img.dataset.src = src;
    if (laterOn) laterIO.observe(img); else laterQ.push(img);
    if (laterQ.length === 1) {
      addEventListener("scroll", startLater, { once: true, passive: true });
      const waitBoot = () => ($("#boot") ? setTimeout(waitBoot, 400) : setTimeout(startLater, 2500));
      waitBoot();
    }
  };

  // Portfolio card: still image, and on hover (after a short pause) a muted
  // preview of the actual video; click opens the full player in a lightbox.
  function workCard(it, i) {
    const video = embedUrl(it.link);
    const a = el(it.link ? "a" : "div", "work-card reveal");
    if (it.link) external(a, it.link);
    const m = el("div", "work-media");
    const src = pics(it)[0];
    if (src) { const img = el("img"); img.alt = it.title; later(img, src); m.append(img); }
    if (video) {
      m.append(el("span", "work-play", "▶"));
      a.dataset.cursor = "Play";
      a.addEventListener("click", (e) => { e.preventDefault(); videoBox(video, it.title); });
      if (finePointer && !reduceMotion) hoverPreview(a, m, it.link);
    }
    m.append(el("span", "work-idx", String(i + 1).padStart(2, "0")));
    const cap = el("div", "work-cap");
    cap.append(el("h3", "", it.title));
    const sub = [it.subtitle, it.meta].filter(Boolean).join(" · ");
    if (sub) cap.append(el("p", "", sub));
    a.append(m, cap);
    return a;
  }
  function previewUrl(link) {
    const yt = (link || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&controls=0&loop=1&playlist=${yt[1]}&modestbranding=1&playsinline=1&rel=0`;
    const vm = (link || "").match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}?background=1&muted=1`;
    return null;
  }
  function hoverPreview(card, media, link) {
    const url = previewUrl(link);
    if (!url) return;
    let timer = 0, frame = null;
    card.addEventListener("pointerenter", () => {
      timer = setTimeout(() => {
        frame = el("iframe", "work-preview");
        frame.src = url;
        frame.title = "Preview";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        frame.allow = "autoplay; encrypted-media";
        frame.addEventListener("load", () => frame && frame.classList.add("on"));
        media.append(frame);
      }, 450);
    });
    card.addEventListener("pointerleave", () => { clearTimeout(timer); if (frame) { frame.remove(); frame = null; } });
  }

  /* Cursor-reactive character.
     Video: cursor X scrubs the clip (left edge = first frame, right edge = last),
     so a "looking left → right" clip makes him follow the cursor.
     Image: subtle parallax until the video exists. */
  const c_name = (h) => [h.headlineTop, h.headlineBottom].filter(Boolean).join(" ");
  function heroMedia(h) {
    const box = $("#stage-media");
    if (h.mediaType === "rig" && h.rig) return rigHero(box, h);
    $("#boot")?.remove();
    if (!h.media) return;
    let cur = 0.5;
    const tx = () => (document.hidden ? 0.5 : pointer.x / innerWidth);

    if (h.mediaType === "video") {
      const v = el("video");
      Object.assign(v, { src: h.media, muted: true, playsInline: true, preload: "auto", disablePictureInPicture: true });
      v.setAttribute("muted", "");
      v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
      box.append(v);
      let seeking = false;
      v.addEventListener("seeked", () => { seeking = false; });
      v.addEventListener("loadedmetadata", () => { v.currentTime = v.duration / 2; });
      const tick = () => {
        cur += (tx() - cur) * 0.12;
        if (!reduceMotion && v.duration && !seeking && Math.abs(v.currentTime - cur * v.duration) > 1 / 60) {
          seeking = true;
          v.currentTime = Math.min(1, Math.max(0, cur)) * (v.duration - 0.05);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else {
      const img = el("img");
      img.src = h.media;
      img.alt = c_name(h);
      box.append(img);
      if (reduceMotion) return;
      let cy = 0.5;
      const tick = () => {
        cur += (tx() - cur) * 0.06;
        cy += (pointer.y / innerHeight - cy) * 0.06;
        img.style.transform = `scale(1.06) translate(${(cur - 0.5) * -22}px, ${(cy - 0.5) * -12}px)`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* Landing loader: a Cycles-style tile render. Dark tiles clear from the
     centre outward (orange brackets on the tiles "rendering"), revealing the
     live viewport underneath while the rig frames download. Progress follows
     the real downloads, but runs at least minDur (anticipation) and never
     longer than maxDur (nobody waits on a slow connection — the rig copes). */
  function bootLoader(progress, label, mem) {
    const boot = $("#boot");
    if (!boot) return;
    let again = false;
    try { again = sessionStorage.getItem("hv-booted") === "1"; sessionStorage.setItem("hv-booted", "1"); } catch (_) {}
    const minDur = reduceMotion ? 0 : again ? 600 : 1800, maxDur = 8000;
    const grid = $(".boot-tiles", boot), left = $(".boot-l", boot), right = $(".boot-r", boot), bar = $(".boot-progress", boot);
    const size = innerWidth < 700 ? 78 : 112;
    const cols = Math.ceil(innerWidth / size), rows = Math.ceil((innerHeight - 26) / size);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    const tiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const b = el("b");
      grid.append(b);
      tiles.push({ b, d: Math.hypot((x + 0.5) / cols - 0.5, ((y + 0.5) / rows - 0.5) * (rows / cols)) });
    }
    const order = [...tiles].sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    let shown = 0, revealed = 0, finished = false, last = t0;
    const tick = (now) => {
      const t = now - t0;
      const target = t >= maxDur ? 1 : Math.min(progress(), minDur ? t / minDur : 1);
      // time-based easing, so throttled/slow tabs don't crawl
      shown += (target - shown) * Math.min(1, ((now - last) / 1000) * 7);
      last = now;
      if (target >= 1 && shown > 0.995) shown = 1;
      const want = Math.floor(shown * order.length);
      while (revealed < want) order[revealed++].b.className = "on";
      order.slice(revealed, revealed + 3).forEach((o) => { o.b.className = "active"; });
      const sec = t / 1000;
      const time = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${(sec % 60).toFixed(2).padStart(5, "0")}`;
      left.textContent = `Fra:1 | Time:${time} | Mem:${mem().toFixed(1)}M | Harshvir Wankhade | ${shown >= 1 ? "Finished" : label()}`;
      right.textContent = `${Math.round(shown * 100)}%`;
      bar.style.width = `${shown * 100}%`;
      if (shown >= 1 && !finished) {
        finished = true;
        boot.addEventListener("transitionend", () => boot.remove(), { once: true });
        boot.classList.add("done");                    // fades after a short beat (CSS delay)
        setTimeout(() => boot.remove(), 1500);         // fallback
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* "Rig" hero: the character is posed by the cursor like a rigged model.
     One clip visits three columns (look left / centre / right). In each he
     pitches top → bottom → top, and the turns between columns happen at the
     top. Cursor X picks the column, cursor Y the height; the playhead then
     travels through the real in-between frames at a capped speed, so every
     move is interpolated by actual footage.
     Every pose inside a column exists twice (down-sweep and up-sweep), so
     before travelling the playhead may hop to its twin — invisible, same
     pose — to take the shorter route: up, across the top, and down.
     Columns: [topSec, bottomSec, topAgainSec] (or [topSec, bottomSec]). */
  function rigHero(box, h) {
    const r = h.rig;
    const fps = r.fps || 15, n = r.frames;
    const sweep = r.sweep && r.sweep.map((s) => s * fps);
    const cols = (r.columns || []).map((c) => c.map((s) => s * fps));
    const rail = $("#rail");
    const speed = (r.speed || 5) * fps * 1.6;  // frames of footage per real second (v2: snappier cap)
    const jump = (r.jump || 5) * fps;        // beyond this distance: crossfade
    const canvas = el("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${h.headlineTop || ""} ${h.headlineBottom || ""} — portrait that turns to follow the cursor`.trim());
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    box.append(canvas);
    document.body.classList.add("rig");

    // Locked X axis across the screen, with a double-arrow handle riding it.
    const axis = el("div", "x-axis");
    const handle = el("div", "x-handle");
    handle.innerHTML = '<svg viewBox="0 0 120 50" aria-hidden="true">' +
      '<path d="M3 25 32 3v12h56V3l29 22-29 22V35H32v12z"/></svg><b>CTRL_head · X lock</b><i></i>';
    handle.setAttribute("aria-hidden", "true");
    axis.setAttribute("aria-hidden", "true");
    const readout = handle.querySelector("i");
    box.append(axis, handle);   // v3: inside the stage, so they scroll with it

    const poster = new Image();
    poster.src = h.media;

    // v2: frames. Optimised set by default (r.pathFast), the sharper one only for
    // tall/HiDPI desktop screens. Key frames (~16, evenly spread over the sweep)
    // load first and end the boot loader; the rest stream in afterwards.
    // Each frame becomes an ImageBitmap (decoded once, off the main thread) so
    // drawing never triggers a decode while the cursor moves.
    const tall = innerHeight * Math.min(devicePixelRatio || 1, 2) > 1200;
    const base = r.pathHi && tall ? r.pathHi : r.pathFast || r.path;
    const frames = Array.from({ length: n }, () => ({ bmp: null, ok: false }));
    let loaded = 0;
    // v2: clamp to the last real frame (the old code asked for a non-existent f_062)
    const lo = sweep ? Math.max(0, Math.floor(sweep[0])) : 0, hi = sweep ? Math.min(n - 1, Math.ceil(sweep[1])) : n - 1;
    const keyCount = Math.min(r.keyFrames || 16, hi - lo + 1);
    const keys = [...new Set(Array.from({ length: keyCount }, (_, k) => Math.round(lo + (hi - lo) * (k / (keyCount - 1)))))];
    const order = [...keys];
    for (const step of [4, 2, 1]) for (let i = lo; i <= hi; i += step) if (!order.includes(i)) order.push(i);
    for (let i = 0; i < n; i++) if (!order.includes(i)) order.push(i);
    let keysLoaded = 0;
    const toBitmap = (img) => (window.createImageBitmap ? createImageBitmap(img).catch(() => img) : img.decode().then(() => img, () => img));
    const fetchNext = () => {
      const i = order.shift();
      if (i == null) return;
      const f = frames[i];
      const img = new Image();
      img.decoding = "async";
      const done = (bmp) => {
        if (bmp && (bmp.width || bmp.naturalWidth)) { f.bmp = bmp; f.ok = true; painted = ""; }
        loaded++;
        if (keys.includes(i)) keysLoaded++;
        // after the key frames, stream the rest at a gentler pace
        if (keysLoaded >= keys.length && "requestIdleCallback" in window) requestIdleCallback(fetchNext, { timeout: 300 });
        else fetchNext();
      };
      img.onload = () => toBitmap(img).then(done, () => done(null));
      img.onerror = () => done(null);
      img.src = `${base}f_${String(i).padStart(3, "0")}.${r.ext || "webp"}`;
    };
    for (let k = 0; k < 6; k++) fetchNext();
    bootLoader(() => keysLoaded / keys.length, () => `Loading rig ${loaded}/${n}`,
      () => frames.reduce((a, f) => a + (f.ok ? f.bmp.width * f.bmp.height * 4 : 0), 0) / 1048576);
    const nearest = (i) => {
      for (let d = 0; d < n; d++) {
        if (frames[i - d] && frames[i - d].ok) return frames[i - d].bmp;
        if (frames[i + d] && frames[i + d].ok) return frames[i + d].bmp;
      }
      return null;
    };

    // Geometry is measured only on resize (never inside the animation loop)
    let fit = null, railBox = null, railHover = false;
    const measure = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      fit = null; painted = "";
      railBox = rail ? rail.getBoundingClientRect() : null;
    };
    if (rail) {
      rail.addEventListener("pointerenter", () => { railHover = true; });
      rail.addEventListener("pointerleave", () => { railHover = false; });
    }
    const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];
    const cover = (img) => {
      const [iw, ih] = dims(img);
      if (fit && fit.iw === iw && fit.ih === ih) return fit;
      const s = canvas.height / ih;
      const w = iw * s;
      const x = w >= canvas.width ? (canvas.width - w) * (r.focus ? r.focus[0] : 0.5) : 0;
      fit = { x, y: 0, w, h: canvas.height, s, iw, ih };
      return fit;
    };

    const [ga, gb] = r.gridStrip || [0.66, 0.95];
    const ready = (img) => img && (img.width || img.naturalWidth) && (img.complete !== false);
    const draw = (img, alpha) => {
      if (!ready(img)) return false;
      const f = cover(img);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, f.x, f.y, f.w, f.h);
      if (f.x + f.w < canvas.width) {
        const sx = f.iw * ga, sw = f.iw * (gb - ga), dw = sw * f.s;
        let x = f.x + f.w * gb, flip = true;
        while (x < canvas.width) {
          if (flip) { ctx.setTransform(-1, 0, 0, 1, x + dw, 0); ctx.drawImage(img, sx, 0, sw, f.ih, 0, 0, dw, f.h); ctx.setTransform(1, 0, 0, 1, 0, 0); }
          else ctx.drawImage(img, sx, 0, sw, f.ih, x, 0, dw, f.h);
          x += dw; flip = !flip;
        }
      }
      ctx.globalAlpha = 1;
      return true;
    };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const targets = (tx, ty) => {
      if (sweep) return [clamp(sweep[0] + (sweep[1] - sweep[0]) * clamp(tx, 0, 1), 0, n - 1)];
      const [top, bottom, top2] = cols[clamp(Math.floor(tx * cols.length), 0, cols.length - 1)];
      const y = clamp(ty, 0, 1);
      const out = [top + (bottom - top) * y];
      if (top2 != null) out.push(top2 - (top2 - bottom) * y);
      return out.map((f) => clamp(f, 0, n - 1));
    };
    const twins = (f) => {
      const out = [f];
      for (const [top, bottom, top2] of cols) {
        if (top2 == null) continue;
        if (f >= top && f <= bottom) out.push(top2 - (top2 - bottom) * ((f - top) / (bottom - top)));
        else if (f > bottom && f <= top2) out.push(top + (bottom - top) * ((top2 - f) / (top2 - bottom)));
      }
      return out;
    };
    const route = (tx, ty) => {
      let best = null;
      for (const s of twins(head)) for (const t of targets(tx, ty)) {
        if (!best || Math.abs(t - s) < Math.abs(best[1] - best[0])) best = [s, t];
      }
      return best;
    };
    const target = (tx, ty) => targets(tx, ty)[0];
    const colOf = (f) => cols.findIndex((c) => f >= Math.min(...c) - 1 && f <= Math.max(...c) + 1);

    // v3: the landing scrolls; stop drawing while the first screen is out of view
    let offscreen = false;
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; }).observe(box);
    let head = target(0.5, 0.5), from = head, fadeT = 1, last = performance.now(), hold = [0.5, 0.5], painted = "";
    let lastHx = null, lastTop = null, lastW = null, lastRead = "";
    measure();
    addEventListener("resize", () => { measure(); lastHx = lastTop = lastW = null; });
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (document.hidden || offscreen) { last = now; return; }
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      // The rail isn't part of the interactive area: map X across the space to its left
      const railLeft = innerWidth;
      const footW = fit ? Math.min(railLeft, fit.w * innerWidth / canvas.width) : railLeft;
      let tx, ty;
      if (railHover) { tx = hold[0]; ty = hold[1]; }
      else if (pointer.moved) { tx = pointer.x / footW; ty = (pointer.y + scrollY) / innerHeight; }
      else {
        const t = now / 1000;
        tx = 0.5 + Math.sin(t * 0.23) * 0.45;
        ty = 0.5 + Math.sin(t * 0.61) * 0.4;
      }
      if (reduceMotion) { tx = 0.5; ty = 0.5; }
      hold = [tx, ty];
      const [start, want] = route(tx, ty);
      head = start;
      const gap = want - head;
      const switched = r.linked === false && colOf(want) !== colOf(head);
      if (switched || Math.abs(gap) > jump) {
        from = head; head = want; fadeT = 0;
      } else if (Math.abs(gap) < 0.02) {
        head = want;
      } else {
        // frame-rate independent exponential ease with a capped travel speed
        head += clamp(gap * (1 - Math.exp(-dt * 16)), -speed * dt, speed * dt);
      }
      fadeT = Math.min(1, fadeT + dt / 0.22);

      const cur = nearest(Math.round(head)), prev = fadeT < 1 ? nearest(Math.round(from)) : null;
      if (cur !== painted || prev || fadeT < 1) {
        if (prev) { if (!draw(prev, 1)) draw(poster, 1); draw(cur, fadeT); }
        else if (!draw(cur, 1)) draw(poster, 1);
        painted = cur;
      }
      window.hvRigState = { head, want, fadeT };
      if (sweep) {
        const p = clamp((head - sweep[0]) / (sweep[1] - sweep[0]), 0, 1);
        const hx = Math.round(p * footW);
        // write to the DOM only when something visibly changed
        if (lastW !== railLeft) { axis.style.width = `${railLeft}px`; lastW = railLeft; }
        if (hx !== lastHx) {
          axis.style.setProperty("--hx", `${hx}px`);
          handle.style.transform = `translate3d(${hx}px, 0, 0)`;
          lastHx = hx;
        }
        if (fit) {
          const ey = Math.round((fit.y + (r.eye ? r.eye[1] : 0.5) * fit.h) / (canvas.height / innerHeight));
          if (ey !== lastTop) { axis.style.top = handle.style.top = `${ey}px`; lastTop = ey; }
        }
        const txt = loaded < n ? `loading ${loaded}/${n}` : `X ${(p * 2 - 1).toFixed(2)}`;
        if (txt !== lastRead) { readout.textContent = txt; lastRead = txt; }
      }
    };
    requestAnimationFrame(tick);
  }

  /* =========================================================
     Inner pages
     ========================================================= */
  function head(s) {
    const h = el("header", "page-head");
    if (s.status) h.append(el("span", "now status", s.status));
    if (s.eyebrow) h.append(el("p", "eyebrow", s.eyebrow));
    h.append(el("h1", "", s.title || ""));
    if (s.intro) h.append(el("p", "intro", s.intro));
    return h;
  }
  const ctaHref = (a, url) => {
    url = url || "page.html?s=contact";
    if (/^https?:/.test(url)) external(a, url); else a.href = href(url);
  };
  const linkCta = (s) => {
    const a = el("a", "link-cta", s.ctaLabel);
    ctaHref(a, s.ctaHref);
    return a;
  };
  const bigCta = (s) => {
    if (!s.ctaLabel) return null;
    const a = el("a", "big-cta reveal", s.ctaLabel);
    ctaHref(a, s.ctaHref);
    return a;
  };
  function stats(list) {
    const d = el("div", "stats");
    for (const { value, label, plus } of list) {
      if (value == null || value === "" || Number.isNaN(value)) continue;
      const box = el("div", "stat reveal");
      const b = el("b", "", String(value));
      if (plus) b.append(el("sup", "", "+"));
      box.append(b, el("span", "", label));
      d.append(box);
    }
    return d;
  }
  const isNow = (it) => /present|now|current/i.test(it.meta || "");
  const yearsIn = (items) => items.flatMap((it) => (it.meta || "").match(/\b(19|20)\d{2}\b/g) || []).map(Number);

  const LAYOUTS = { showcase, timeline, tickets, builder, grid, list, shop };

  function renderSection(c, s) {
    document.title = `${s.nav || s.title} — ${c.site.name}`;
    if (s.intro) $('meta[name="description"]').content = s.intro;
    const items = visible(s.items);
    // "auto" (or unknown) = grid when entries have images, list otherwise
    const layout = LAYOUTS[s.layout] ? s.layout : items.some((it) => pics(it).length) ? "grid" : "list";
    // v2: a page whose entries are all drafts shows its heading + call to action only
    if (!items.length && layout !== "builder" && layout !== "shop") {
      $("#page").replaceChildren(...[head(s), bigCta(s) || (s.ctaLabel ? linkCta(s) : null)].filter(Boolean));
      document.body.dataset.layout = "empty";
      return;
    }
    document.body.dataset.layout = layout;
    LAYOUTS[layout](s, items);
  }

  /* ---------- Showcase: big-name roster with campus photos that unroll on hover ---------- */
  function showcase(s, items) {
    const h = head(s);
    const years = yearsIn(items);
    h.append(stats([
      { value: items.length, label: s.countLabel || "Institutions" },
      { value: items.filter(isNow).length || null, label: s.currentLabel || "Teaching now" },
      { value: years.length ? Math.min(...years) : null, label: "Since" },
    ]));

    const names = items.map((it) => it.title).filter(Boolean);
    const marquee = el("div", "marquee");
    marquee.setAttribute("aria-hidden", "true");
    const track = el("div", "marquee-track");
    for (let i = 0; i < 2; i++) names.forEach((n) => track.append(el("span", "", n)));
    marquee.append(track);

    const float = el("figure", "campus-float");
    const fImg = el("img");
    fImg.alt = "";
    const fCap = el("figcaption");
    float.append(fImg, fCap);

    const roster = el("div", "roster");
    for (const it of items) {
      const row = el(it.link ? "a" : "div", "roster-row reveal");
      if (it.link) external(row, it.link);
      const name = el("h3", "roster-name");
      if (it.image) {
        const logo = el("img");
        logo.src = it.image; logo.alt = `${it.title || ""} logo`; logo.loading = "lazy";
        name.append(logo);
      }
      name.append(el("span", "", it.title || ""));
      const side = el("div", "roster-side");
      if (isNow(it)) side.append(el("span", "now", s.nowLabel || "Now teaching"));
      if (it.subtitle) side.append(el("span", "role", it.subtitle));
      if (it.meta && !/^\s*(present|now|current)\s*$/i.test(it.meta)) side.append(el("span", "years", it.meta));
      row.append(name, side);
      if (it.description) row.append(el("p", "roster-desc", it.description));

      const campus = pics(it, it.campus);
      if (campus.length) {
        row.classList.add("has-campus");
        side.append(Object.assign(el("span", "campus-hint"), { title: "Hover to see the campus" }));
        side.lastChild.append(window.hvIcon("image"), el("span", "", campus.length > 1 ? `Campus · ${campus.length}` : "Campus"));
        // Touch screens: the photo unrolls inline when scrolled into view
        const inline = el("figure", "campus-inline");
        const stack = el("div", "campus-pics");
        campus.forEach((src, i) => {
          const img = el("img");
          img.src = src; img.alt = it.campusCaption || it.title; img.loading = "lazy";
          if (i) img.classList.add("off");
          stack.append(img);
        });
        if (campus.length > 1) slides(stack, campus.length);
        inline.append(stack, el("figcaption", "", [it.campusCaption, it.campusCredit].filter(Boolean).join(" — ")));
        row.append(inline);
        // Mouse: the floating photo, stepping through the pictures while hovered
        let cycle = null;
        row.addEventListener("pointerenter", (e) => {
          if (e.pointerType !== "mouse") return;
          let n = 0;
          fImg.src = campus[0];
          fImg.alt = it.campusCaption || it.title;
          fCap.textContent = [it.campusCaption, it.campusCredit].filter(Boolean).join(" — ");
          float.classList.add("show");
          if (campus.length > 1) cycle = setInterval(() => { fImg.src = campus[++n % campus.length]; }, 1400);
        });
        row.addEventListener("pointerleave", () => { float.classList.remove("show"); clearInterval(cycle); });
      }
      roster.append(row);
    }

    // The floating campus photo trails the cursor
    let fx = pointer.x, fy = pointer.y;
    const follow = () => {
      fx += (pointer.x - fx) * 0.14;
      fy += (pointer.y - fy) * 0.14;
      const w = float.offsetWidth, hgt = float.offsetHeight;
      const x = Math.min(innerWidth - w - 16, Math.max(16, fx + 36));
      const y = Math.min(innerHeight - hgt - 16, Math.max(16, fy - hgt / 2));
      float.style.transform = `translate(${x}px, ${y}px) rotate(${(pointer.x - fx) * 0.04}deg)`;
      requestAnimationFrame(follow);
    };
    if (finePointer) requestAnimationFrame(follow);

    const credits = items.filter((it) => it.campus && it.campusCredit);
    let creditLine = null;
    if (credits.length) {
      creditLine = el("p", "credits", "Campus photos via Wikimedia Commons: ");
      credits.forEach((it, i) => {
        if (i) creditLine.append("; ");
        const a = el("a", "", `${it.campusCaption || it.title} (${it.campusCredit})`);
        if (it.campusCreditUrl) external(a, it.campusCreditUrl);
        creditLine.append(a);
      });
    }

    $("#page").classList.add("wide");
    $("#page").replaceChildren(...[h, names.length > 1 ? marquee : null, roster, bigCta(s), creditLine].filter(Boolean));
    // Outside #page: its entrance animation would make position:fixed relative to it
    document.body.append(float);
  }

  /* ---------- Timeline: production history that draws itself as you scroll ---------- */
  function timeline(s, items) {
    const h = head(s);
    const years = yearsIn(items);
    const since = years.length ? Math.min(...years) : null;
    h.append(stats([
      // s.years (set in admin) overrides the count worked out from the listed dates
      { value: Number(s.years) || (since ? new Date().getFullYear() - since : null), label: "Years in production", plus: true },
      { value: items.length, label: s.countLabel || "Studios" },
      { value: new Set(items.map((it) => it.tag).filter(Boolean)).size || null, label: "Sectors" },
    ]));
    if (s.ctaLabel) h.append(linkCta(s));

    const tl = el("div", "timeline");
    const line = el("div", "tl-line");
    const prog = el("div", "tl-progress");
    tl.append(line, prog);
    items.forEach((it, i) => {
      const row = el(it.link ? "a" : "div", "tl-item reveal");
      if (it.link) external(row, it.link);
      const when = el("div", "tl-when", it.meta || "");
      const node = el("span", "tl-node");
      const body = el("div", "tl-body");
      if (it.tag) body.append(el("span", "chip", it.tag));
      body.append(el("h3", "", it.title || ""));
      if (it.subtitle) body.append(el("p", "tl-role", it.subtitle));
      if (it.description) body.append(el("p", "tl-desc", it.description));
      body.append(el("span", "tl-index", String(i + 1).padStart(2, "0")));
      row.append(when, node, body);
      tl.append(row);
    });

    const update = () => {
      const r = tl.getBoundingClientRect();
      const mark = innerHeight * 0.62;
      const p = Math.min(1, Math.max(0, (mark - r.top) / r.height));
      prog.style.height = p * 100 + "%";
      $$(".tl-item", tl).forEach((row) => {
        row.classList.toggle("passed", row.querySelector(".tl-node").getBoundingClientRect().top < mark);
      });
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    requestAnimationFrame(update);

    $("#page").classList.add("wide");
    $("#page").replaceChildren(h, tl);
  }

  /* ---------- Tickets: workshops as event passes ---------- */
  function tickets(s, items) {
    const h = head(s);
    const wrap = el("div", "tickets");
    items.forEach((it, i) => {
      const t = el(it.link ? "a" : "div", "ticket reveal tilt");
      if (it.link) external(t, it.link);
      const stub = el("div", "ticket-stub");
      stub.append(el("span", "ticket-no", "No. " + String(i + 1).padStart(3, "0")), el("span", "ticket-date", it.meta || ""));
      const body = el("div", "ticket-body");
      if (it.subtitle) body.append(el("p", "eyebrow", it.subtitle));
      body.append(el("h3", "", it.title || ""));
      if (it.description) body.append(el("p", "ticket-desc", it.description));
      if (it.tag) body.append(el("span", "chip", it.tag));
      const barcode = el("span", "barcode");
      barcode.setAttribute("aria-hidden", "true");
      body.append(barcode);
      t.append(stub, body);
      wrap.append(t);
    });
    $("#page").replaceChildren(...[h, wrap, bigCta(s)].filter(Boolean));
  }

  /* ---------- Builder: pick a format + topics, get a ready-made email ---------- */
  function builder(s, items) {
    const h = head(s);
    const email = siteContent.site.email || siteContent.contact.email;
    const state = { format: null, topics: new Set() };

    const tools = csv(s.tools);
    let toolRow = null;
    if (tools.length) {
      toolRow = el("div", "tools reveal");
      toolRow.append(el("span", "tools-label", "Taught in"));
      tools.forEach((t, i) => {
        const chip = el("span", "tool", t);
        chip.style.setProperty("--i", i);
        toolRow.append(chip);
      });
    }

    const step = (n, label) => {
      const d = el("div", "step reveal");
      d.append(el("span", "step-no", n), el("h2", "", label));
      return d;
    };

    const formats = el("div", "formats");
    items.forEach((it) => {
      const b = el("button", "format tilt");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.append(el("span", "format-meta", [it.subtitle, it.meta].filter(Boolean).join(" · ")), el("h3", "", it.title || ""));
      if (it.description) b.append(el("p", "", it.description));
      b.addEventListener("click", () => {
        state.format = state.format === it ? null : it;
        $$(".format", formats).forEach((x) => x.setAttribute("aria-pressed", "false"));
        if (state.format) b.setAttribute("aria-pressed", "true");
        sync();
      });
      formats.append(b);
    });

    const topicsWrap = el("div", "topics");
    csv(s.topics).forEach((t) => {
      const b = el("button", "topic", t);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        state.topics.has(t) ? state.topics.delete(t) : state.topics.add(t);
        b.setAttribute("aria-pressed", String(state.topics.has(t)));
        sync();
      });
      topicsWrap.append(b);
    });

    const bar = el("div", "summary");
    const sumText = el("p", "summary-text");
    const send = el("a", "btn-send", s.ctaLabel || "Request this session");
    bar.append(sumText, send);

    function sync() {
      const f = state.format ? state.format.title : null;
      const t = [...state.topics];
      sumText.replaceChildren();
      if (!f && !t.length) {
        sumText.append(el("span", "muted", "Pick a format and a few topics ↑"));
      } else {
        sumText.append(el("b", "", f || "Any format"));
        if (t.length) sumText.append(el("span", "muted", " — " + t.join(", ")));
      }
      const subject = `1:1 session request${f ? " — " + f : ""}`;
      const body = [
        "Hi Harshvir,", "",
        `I'd like to book: ${f || "(not sure yet)"}`,
        t.length ? `I want to work on: ${t.join(", ")}` : "",
        "", "A bit about me and my current level:", "", "",
      ].join("\n");
      send.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      bar.classList.toggle("ready", Boolean(f || t.length));
    }
    sync();

    const nodes = [h, toolRow];
    if (items.length) nodes.push(step("01", "Pick a format"), formats);
    if (topicsWrap.children.length) nodes.push(step(items.length ? "02" : "01", "What do you want to work on?"), topicsWrap);
    nodes.push(bar);
    $("#page").replaceChildren(...nodes.filter(Boolean));
  }

  /* ---------- Grid: tilting tiles, category filter, in-page video player ---------- */
  function embedUrl(link) {
    const yt = (link || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`;
    const vm = (link || "").match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
    return null;
  }

  function grid(s, items) {
    const h = head(s);
    if (s.ctaLabel) h.append(linkCta(s));

    const cats = [...new Set(items.map((it) => it.subtitle).filter(Boolean))];
    let filters = null;
    const wrap = el("div", "tiles");
    if (cats.length > 1) {
      filters = el("div", "filters reveal");
      ["All", ...cats].forEach((cat, i) => {
        const b = el("button", "filter", cat);
        b.type = "button";
        b.setAttribute("aria-pressed", String(i === 0));
        b.addEventListener("click", () => {
          $$(".filter", filters).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          $$(".tile", wrap).forEach((t) => t.classList.toggle("hidden", cat !== "All" && t.dataset.cat !== cat));
        });
        filters.append(b);
      });
    }

    items.forEach((it) => {
      const video = embedUrl(it.link);
      const tile = el(it.link ? "a" : "div", "tile reveal");
      tile.dataset.cat = it.subtitle || "";
      if (it.link) {
        external(tile, it.link);
        tile.dataset.cursor = video ? "Play" : "Open";
        if (video) tile.addEventListener("click", (e) => { e.preventDefault(); videoBox(video, it.title); });
      }
      const media = el("div", "tile-media tilt");
      if (video && finePointer && !reduceMotion) hoverPreview(tile, media, it.link);
      const photos = pics(it);
      if (photos.length) {
        photos.forEach((src, i) => {
          const img = el("img");
          img.src = src; img.alt = it.title || ""; img.loading = "lazy";
          if (i) img.classList.add("off");
          media.append(img);
        });
        if (photos.length > 1) slides(media, photos.length);
        if (!it.link) {
          tile.dataset.cursor = "View";
          tile.addEventListener("click", () => photoBox(photos, +(media.dataset.at || 0), it.title));
        }
      } else {
        media.classList.add("empty");
        media.append(window.hvIcon("cube"));
      }
      if (video) {
        const play = el("span", "play");
        play.append(window.hvIcon("play"));
        media.append(play);
      }
      media.append(el("span", "glare"));
      tile.append(media, el("h3", "", it.title || ""));
      const sub = [it.subtitle, it.meta].filter(Boolean).join(" · ");
      if (sub) tile.append(el("p", "sub", sub));
      if (it.description) tile.append(el("p", "desc", it.description));
      wrap.append(tile);
    });
    $("#page").replaceChildren(...[h, filters, wrap].filter(Boolean));
  }

  // Prev/next arrows, dots and swipe over a stack of <img> (only one without .off shows)
  function slides(media, count, onChange) {
    const imgs = $$("img", media);
    const dots = el("div", "pic-dots");
    for (let i = 0; i < count; i++) dots.append(el("span"));
    let at = 0;
    const go = (i) => {
      at = (i + count) % count;
      media.dataset.at = at;
      imgs.forEach((img, j) => img.classList.toggle("off", j !== at));
      [...dots.children].forEach((d, j) => d.classList.toggle("on", j === at));
      onChange?.(at);
    };
    const arrow = (cls, text, d) => {
      const b = el("button", "pic-nav " + cls, text);
      b.type = "button";
      b.setAttribute("aria-label", d < 0 ? "Previous picture" : "Next picture");
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); go(at + d); });
      return b;
    };
    let sx = null;
    media.addEventListener("pointerdown", (e) => { sx = e.clientX; });
    media.addEventListener("pointerup", (e) => {
      if (sx == null || e.pointerType === "mouse") return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) go(at - Math.sign(dx));
    });
    media.append(arrow("prev", "‹", -1), arrow("next", "›", 1), dots);
    go(0);
    return go;
  }

  function lightbox(frame, label, keys) {
    const box = el("div", "lightbox");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", label);
    const close = el("button", "lightbox-close", "Close ✕");
    close.type = "button";
    box.append(frame, close);
    const done = () => {
      box.classList.remove("open");
      setTimeout(() => box.remove(), 300);
      removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") done(); else keys?.(e); };
    box.addEventListener("click", (e) => { if (e.target === box) done(); });
    close.addEventListener("click", done);
    addEventListener("keydown", onKey);
    document.body.append(box);
    requestAnimationFrame(() => box.classList.add("open"));
    close.focus();
  }
  function videoBox(src, title) {
    const frame = el("div", "lightbox-frame");
    const iframe = el("iframe");
    Object.assign(iframe, { src, title: title || "Video", allow: "autoplay; fullscreen; picture-in-picture", allowFullscreen: true });
    frame.append(iframe);
    lightbox(frame, title || "Video");
  }
  function photoBox(photos, start, title) {
    const frame = el("div", "lightbox-photos");
    photos.forEach((src) => {
      const img = el("img");
      img.src = src; img.alt = title || "";
      frame.append(img);
    });
    const go = photos.length > 1 ? slides(frame, photos.length) : null;
    go?.(start);
    lightbox(frame, title || "Pictures", (e) => {
      if (!go) return;
      if (e.key === "ArrowLeft") go(+frame.dataset.at - 1);
      if (e.key === "ArrowRight") go(+frame.dataset.at + 1);
    });
  }

  /* ---------- Shop (v2): "Asset Bay" — digital products, paid by UPI ----------
     Payment is a UPI QR code + copyable UPI ID (desktop-first), with an
     "Open in UPI app" link as a secondary option. After paying, the buyer sends
     the UTR (UPI transaction reference) through a short form; the files are then
     delivered by email. A static site can't verify payments by itself — every
     order is checked by hand against the UPI app's history. */
  const SHOP_CATS = ["3D Assets", "Blender Add-ons", "Photoshop Brushes", "Other"];
  const todo = (v) => !v || /\bTODO\b/i.test(String(v));
  const inr = (v) => {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    return todo(v) || !n ? null : n;
  };
  const fmtInr = (n) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  function shop(s, items) {
    const h = head(s);
    const pay = s.payment || {};
    const cats = [...SHOP_CATS, ...new Set(items.map((it) => it.category).filter((c) => c && !SHOP_CATS.includes(c)))];
    const catOf = (it) => (cats.includes(it.category) ? it.category : "Other");

    const filters = el("div", "filters shop-filters reveal");
    filters.setAttribute("role", "toolbar");
    filters.setAttribute("aria-label", "Filter products");
    const wrap = el("div", "products");
    const empty = el("p", "shop-empty", "Nothing in this category yet — check back soon.");
    empty.hidden = true;
    const setCat = (cat) => {
      $$(".filter", filters).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cat === cat)));
      let shown = 0;
      $$(".product", wrap).forEach((t) => { const on = cat === "All" || t.dataset.cat === cat; t.classList.toggle("hidden", !on); shown += on; });
      empty.hidden = shown > 0;
    };
    ["All", ...cats].forEach((cat) => {
      const count = cat === "All" ? items.length : items.filter((it) => catOf(it) === cat).length;
      if (!count) return;   // categories with no products are not shown
      const b = el("button", "filter");
      b.type = "button";
      b.dataset.cat = cat;
      b.append(cat, el("sup", "", String(count)));
      b.addEventListener("click", () => setCat(cat));
      filters.append(b);
    });

    items.forEach((it, i) => {
      const card = el("article", "product reveal");
      card.dataset.cat = catOf(it);
      const media = el("div", "product-media");
      const photos = pics(it);
      if (photos.length) {
        photos.forEach((src, j) => {
          const img = el("img");
          img.src = src; img.alt = `${it.title} — preview ${j + 1}`; img.loading = "lazy";
          if (j) img.classList.add("off");
          media.append(img);
        });
        if (photos.length > 1) slides(media, photos.length);
      } else {
        media.classList.add("empty");
        media.append(window.hvIcon("cube"));
      }
      media.append(el("span", "render-tag", `Render · ${String(i + 1).padStart(3, "0")}`));
      const body = el("div", "product-body");
      body.append(el("span", "chip", catOf(it)), el("h3", "", it.title));
      if (it.pitch) body.append(el("p", "pitch", it.pitch));
      const specs = el("dl", "specs");
      [["Includes", it.includes], ["Formats", it.formats], ["Works with", it.compatibility], ["Licence", it.licence]]
        .filter(([, v]) => !todo(v))
        .forEach(([k, v]) => specs.append(el("dt", "", k), el("dd", "", v)));
      if (specs.children.length) body.append(specs);
      const price = inr(it.price);
      const foot = el("div", "product-foot");
      if (price) foot.append(el("span", "price", fmtInr(price)));   // no price set → nothing shown
      const buy = el("button", "btn-buy", todo(pay.upiId) ? "Details" : "Buy with UPI");
      buy.type = "button";
      buy.addEventListener("click", () => productBox(s, it, pay));
      foot.append(buy);
      body.append(foot);
      card.append(media, body);
      card.addEventListener("click", (e) => { if (!e.target.closest("button, a")) productBox(s, it, pay); });
      card.dataset.cursor = "View";
      wrap.append(card);
    });

    const how = el("ol", "how reveal");
    [["Pick", "Choose a product and open it."], ["Pay", "Scan the UPI QR with any UPI app (GPay, PhonePe, Paytm…)."],
     ["Send the UTR", "Paste the 12-digit UPI reference in the short form."],
     ["Download", pay.deliveryNote || "Your download link arrives by email once the payment is checked."]]
      .forEach(([t, d], k) => { const li = el("li"); li.append(el("b", "", `0${k + 1} ${t}`), el("span", "", d)); how.append(li); });

    $("#page").classList.add("wide");
    $("#page").replaceChildren(...[h, filters, wrap, empty, how, bigCta(s)].filter(Boolean));
  }

  function upiLink(pay, it, ref) {
    const q = new URLSearchParams({ pa: pay.upiId, pn: pay.payeeName || siteContent.site.name, cu: "INR", tn: `${it.sku || it.title} ${ref}`.slice(0, 50) });
    const price = inr(it.price);
    if (price) q.set("am", price.toFixed(2));
    return "upi://pay?" + q.toString().replace(/\+/g, "%20").replace(/%40/g, "@");   // UPI apps expect a literal @ in pa=
  }
  function qrSvg(text) {
    if (typeof window.qrcode !== "function") return null;
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const wrap = el("div", "qr");
    wrap.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
    const svg = wrap.querySelector("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "UPI payment QR code");
    return wrap;
  }

  function productBox(s, it, pay) {
    const ref = "HV" + Date.now().toString(36).toUpperCase().slice(-6);
    const price = inr(it.price);
    const frame = el("div", "lightbox-shop");
    const left = el("div", "ls-info");
    left.append(el("span", "chip", it.category || "Other"), el("h2", "", it.title));
    const photos = pics(it);
    if (photos.length) {
      const media = el("div", "ls-media");
      photos.forEach((src, j) => { const img = el("img"); img.src = src; img.alt = `${it.title} — preview ${j + 1}`; if (j) img.classList.add("off"); media.append(img); });
      if (photos.length > 1) slides(media, photos.length);
      left.append(media);
    }
    if (it.description) it.description.split(/\n{2,}/).forEach((para) => left.append(el("p", "ls-desc", para)));
    const specs = el("dl", "specs");
    [["Includes", it.includes], ["Formats", it.formats], ["Works with", it.compatibility], ["Licence", it.licence]]
      .filter(([, v]) => !todo(v)).forEach(([k, v]) => specs.append(el("dt", "", k), el("dd", "", v)));
    if (specs.children.length) left.append(specs);

    const right = el("div", "ls-pay");
    const canPay = !todo(pay.upiId);   // works with or without a price
    if (canPay) {
      const link = upiLink(pay, it, ref);
      right.append(el("p", "eyebrow", "Step 1 · Pay with UPI"));
      if (price) right.append(el("p", "ls-price", fmtInr(price)));
      const qr = qrSvg(link);
      if (qr) right.append(qr);
      if (price) right.append(el("p", "ls-hint", "Scan with any UPI app — the amount fills in by itself."));
      else {
        const hint = el("p", "ls-hint", "Scan with any UPI app and enter the amount. Questions? ");
        const ask = el("a", "", "Get in touch");
        ask.href = "page.html?s=contact";
        hint.append(ask);
        right.append(hint);
      }
      const idRow = el("div", "upi-id");
      idRow.append(el("span", "", "UPI ID"), el("code", "", pay.upiId));
      const copy = el("button", "btn-copy", "Copy");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(pay.upiId); copy.textContent = "Copied ✓"; }
        catch (_) { copy.textContent = "Select & copy"; }
        setTimeout(() => { copy.textContent = "Copy"; }, 1800);
      });
      idRow.append(copy);
      right.append(idRow, el("p", "ls-ref", `Payment note: ${it.sku || it.title} ${ref}`));
      const open = el("a", "link-cta small", "Open in UPI app");
      open.href = link;
      right.append(open);

      // Step 2: "I've paid" → UTR form
      const paid = el("button", "btn-send", "I've paid");
      paid.type = "button";
      right.append(paid);
      paid.addEventListener("click", () => right.replaceChildren(...paidForm(s, it, pay, ref, price)));
    } else {
      right.append(el("p", "eyebrow", "Coming soon"), el("p", "ls-hint", "UPI checkout for this product opens soon."));
    }
    if (it.gumroad || it.link) {
      const g = el("a", "link-cta small", "Or buy on Gumroad");
      external(g, it.gumroad || it.link);
      right.append(g);
    }
    frame.append(left, right);
    lightbox(frame, it.title);
  }

  function paidForm(s, it, pay, ref, price) {
    const email = siteContent.site.email || siteContent.contact.email;
    const form = el("form", "utr-form");
    const fld = (name, label, attrs = {}) => {
      const l = el("label", "", label);
      const i = el("input");
      Object.assign(i, { name, required: true, ...attrs });
      l.append(i);
      return [l, i];
    };
    const [lName, iName] = fld("name", "Your name", { autocomplete: "name" });
    const [lMail, iMail] = fld("email", "Email for the download link", { type: "email", autocomplete: "email" });
    const [lUtr, iUtr] = fld("utr", "UPI reference (UTR, 12 digits)", { inputMode: "numeric", pattern: "\\d{12}", maxLength: 12, placeholder: "e.g. 412345678901" });
    const note = el("p", "ls-hint", `Product: ${it.title}${price ? " · " + fmtInr(price) : ""} · Ref ${ref}`);
    const send = el("button", "btn-send", "Send for delivery");
    send.type = "submit";
    const status = el("p", "ls-status");
    status.setAttribute("role", "status");
    form.append(lName, lMail, lUtr, note, send, status);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = { product: it.title, sku: it.sku || "", price: price ? fmtInr(price) : "", reference: ref, name: iName.value.trim(), email: iMail.value.trim(), utr: iUtr.value.trim() };
      const ok = () => form.replaceChildren(el("p", "eyebrow", "Received"), el("h3", "", "Thanks — order received."),
        el("p", "ls-hint", pay.deliveryNote || "Your download link arrives by email once the payment is checked."));
      // TODO(owner): set payment.formEndpoint in content.json (e.g. a Formspree URL).
      // Until then the order opens as a pre-filled email instead.
      if (!todo(pay.formEndpoint)) {
        send.disabled = true; status.textContent = "Sending…";
        try {
          const res = await fetch(pay.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(res.status);
          return ok();
        } catch (_) { send.disabled = false; status.textContent = "Couldn't send — opening your email app instead."; }
      }
      const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
      location.href = `mailto:${email}?subject=${encodeURIComponent(`Order ${ref} — ${it.title}`)}&body=${encodeURIComponent(body)}`;
      ok();
    });
    return [el("p", "eyebrow", "Step 2 · Confirm your payment"), form];
  }

  /* ---------- List: plain rows ---------- */
  function list(s, items) {
    const h = head(s);
    if (s.ctaLabel) h.append(linkCta(s));
    const wrap = el("div", "rows");
    for (const it of items) {
      const row = el(it.link ? "a" : "div", "row reveal");
      if (it.link) external(row, it.link);
      row.append(el("h3", "", it.title || ""), el("span", "sub", it.subtitle || ""), el("span", "meta", it.meta || ""));
      if (it.description) row.append(el("p", "desc", it.description));
      wrap.append(row);
    }
    $("#page").replaceChildren(h, wrap);
  }

  /* ---------- Contact: fill-in-the-blanks message ---------- */
  function renderContact(c) {
    const k = c.contact;
    document.title = `Contact — ${c.site.name}`;
    document.body.dataset.layout = "contact";
    const email = k.email || c.site.email;
    const h = head({ eyebrow: k.eyebrow, title: k.title, intro: k.text });

    const pick = (options) => {
      const sel = el("select", "blank");
      options.forEach((o) => sel.append(Object.assign(el("option", "", o), { value: o })));
      return sel;
    };
    const field = (placeholder, type = "text") => {
      const i = el("input", "blank");
      Object.assign(i, { placeholder, type, autocomplete: type === "email" ? "email" : "name" });
      const fit = () => { i.style.width = Math.max(placeholder.length, i.value.length) + 1 + "ch"; };
      i.addEventListener("input", fit);
      fit();
      return i;
    };
    const who = pick(csv(k.whoOptions).length ? csv(k.whoOptions) : ["a university", "a studio", "a student"]);
    const what = pick(csv(k.whatOptions).length ? csv(k.whatOptions) : ["work together"]);
    const name = field("your name");
    const reply = field("your email", "email");

    const form = el("form", "composer reveal");
    const line = (...parts) => {
      const p = el("p");
      parts.forEach((x) => p.append(typeof x === "string" ? document.createTextNode(x) : x));
      return p;
    };
    form.append(
      line("Hi Harshvir, I'm ", name, " from ", who, "."),
      line("I'd love to ", what, "."),
      line("Reach me at ", reply, "."),
    );
    const send = el("button", "btn-send", "Send it");
    send.type = "submit";
    form.append(send);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = name.value.trim();
      const subject = `${n ? n + " — " : ""}${what.value}`;
      const body = [
        "Hi Harshvir,", "",
        `I'm ${n || "writing"} from ${who.value}, and I'd love to ${what.value}.`,
        reply.value.trim() ? `You can reach me at ${reply.value.trim()}.` : "",
        "", "",
      ].join("\n");
      location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    const lines = el("div", "contact-lines reveal");
    lines.append(el("span", "or", "Or directly"));
    if (email) { const a = el("a", "", email); a.href = "mailto:" + email; lines.append(a); }
    if (k.phone) { const a = el("a", "", k.phone); a.href = "tel:" + k.phone.replace(/\s/g, ""); lines.append(a); }
    if (k.location) lines.append(el("span", "", k.location));

    $("#page").replaceChildren(h, form, lines);
  }

  function renderPage(c) {
    if (current === "contact") return renderContact(c);
    const s = c.sections.find((x) => x.id === current);
    if (s) return renderSection(c, s);
    const back = el("a", "link-cta", "Back home");
    back.href = href("./");
    $("#page").replaceChildren(head({ title: "Page not found", intro: "That page doesn't exist (anymore)." }), back);
  }

  /* =========================================================
     Interaction layer
     ========================================================= */

  // Hand the page's 3D object over to objects.js (a wireframe model per section)
  function announcePage(c) {
    if (isHome) return;
    const s = c.sections.find((x) => x.id === current);
    if (!s && current !== "contact") return;
    document.body.dataset.section = current;
    document.body.dataset.model = (s ? s.model : c.contact.model) || "";
    document.dispatchEvent(new Event("hv:page"));
  }

  // Cursor ring (v2): the normal mouse arrow always stays visible; the ring is a
  // light overlay that sits exactly on the pointer (no trailing lag), grows over
  // anything clickable and can carry a label ("Play", "Open"). Off on touch
  // screens, with reduced motion, and on the landing page (the rig has its own handle).
  function cursor() {
    if (!finePointer || reduceMotion || document.body.classList.contains("rig")) return;
    const ring = el("div", "cursor");
    ring.setAttribute("aria-hidden", "true");
    const label = el("span");
    ring.append(label);
    document.body.append(ring);
    let queued = false;
    const place = () => { queued = false; ring.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`; };
    if (!pointer.moved) ring.classList.add("gone");   // hidden until the mouse actually moves
    addEventListener("pointermove", () => { ring.classList.remove("gone"); if (!queued) { queued = true; requestAnimationFrame(place); } }, { passive: true });
    place();
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, select, input, [data-cursor], #rail");
      ring.classList.toggle("hover", Boolean(t));
      const text = t?.closest("[data-cursor]")?.dataset.cursor || "";
      label.textContent = text;
      ring.classList.toggle("labelled", Boolean(text));
    });
    document.addEventListener("pointerleave", () => ring.classList.add("gone"));
    document.addEventListener("pointerenter", () => ring.classList.remove("gone"));
  }

  // Cards lean toward the cursor, with a moving highlight
  function tilt() {
    if (!finePointer || reduceMotion) return;
    $$(".tilt").forEach((n) => {
      n.addEventListener("pointermove", (e) => {
        const r = n.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        n.style.setProperty("--rx", `${(0.5 - py) * 10}deg`);
        n.style.setProperty("--ry", `${(px - 0.5) * 12}deg`);
        n.style.setProperty("--gx", `${px * 100}%`);
        n.style.setProperty("--gy", `${py * 100}%`);
      });
      n.addEventListener("pointerleave", () => {
        n.style.setProperty("--rx", "0deg");
        n.style.setProperty("--ry", "0deg");
      });
    });
  }

  function reveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
    $$(".reveal").forEach((n, i) => { n.style.setProperty("--d", `${Math.min(i, 8) * 60}ms`); io.observe(n); });
  }

  // Deter casual saving of media: no "Save image/video as" or copy menu,
  // no dragging images out, no Ctrl/Cmd+S "save page". (Nothing on the web
  // is truly undownloadable — this just closes the easy routes.)
  function protectMedia() {
    const media = "img, video, canvas, picture, iframe, .tile, .campus-float, .campus-inline, .lightbox, .stage, .obj-wrap";
    document.addEventListener("contextmenu", (e) => { if (e.target.closest(media)) e.preventDefault(); });
    document.addEventListener("dragstart", (e) => { if (e.target.closest(media)) e.preventDefault(); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") e.preventDefault();
    });
    // images added later (lightbox, campus photos) are covered by the delegated handlers;
    // mark the ones present now as non-draggable too
    $$("img").forEach((i) => { i.draggable = false; });
    new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === "IMG") n.draggable = false;
      n.querySelectorAll?.("img").forEach((i) => { i.draggable = false; });
    }))).observe(document.body, { childList: true, subtree: true });
  }

  // Soft fade between pages
  function transitions() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || a.target === "_blank" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /^(mailto|tel):/.test(a.href) || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(() => { location.href = a.href; }, reduceMotion ? 0 : 220);
    });
    addEventListener("pageshow", () => document.body.classList.remove("leaving"));
  }

  let siteContent = null;
  loadContent()
    .then((c) => {
      siteContent = c;
      renderShared(c);
      isHome ? renderHome(c) : renderPage(c);
      announcePage(c);
      cursor();
      tilt();
      reveal();
      transitions();
      protectMedia();
    })
    .catch((err) => {
      console.error(err);
      $("#boot")?.remove();
      document.body.insertAdjacentHTML("beforeend", '<p class="missing" style="position:fixed;inset:40% 0 auto;text-align:center">Could not load content.</p>');
    });
})();
