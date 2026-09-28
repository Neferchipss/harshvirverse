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
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const isHome = document.body.classList.contains("home");
  const current = isHome ? "home" : params.get("s") || "";
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
      ...c.sections.map((s) => ({ id: s.id, label: s.nav || s.title, icon: s.icon, url: pageUrl(s.id) })),
      { id: "contact", label: "Contact", icon: "send", url: pageUrl("contact") },
    ];
    $("#rail").replaceChildren(...links.map((l) => {
      const a = el("a", l.id === current ? "active" : "");
      a.href = l.url;
      a.setAttribute("aria-label", l.label);
      if (l.id === current) a.setAttribute("aria-current", "page");
      a.append(window.hvIcon(l.icon, l.id), el("span", "tip", l.label));
      return a;
    }));

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
    document.title = [c.hero.headlineTop, c.hero.headlineBottom].filter(Boolean).join(" ") || c.site.name;
    // "A × B × C" — separators get the accent colour
    const tag = $("#tagline");
    (c.hero.tagline || "").split(/\s*×\s*/).filter(Boolean).forEach((part, i) => {
      if (i) tag.append(el("span", "x", "×"));
      tag.append(el("span", "", part));
    });
    heroMedia(c.hero);
  }

  /* Cursor-reactive character.
     Video: cursor X scrubs the clip (left edge = first frame, right edge = last),
     so a "looking left → right" clip makes him follow the cursor.
     Image: subtle parallax until the video exists. */
  function heroMedia(h) {
    const box = $("#stage-media");
    if (h.mediaType === "rig" && h.rig) return rigHero(box, h);
    if (!h.media) return;
    let cur = 0.5;
    const tx = () => (document.hidden ? 0.5 : pointer.x / innerWidth);

    if (h.mediaType === "video") {
      const v = el("video");
      Object.assign(v, { src: h.media, muted: true, playsInline: true, preload: "auto" });
      v.setAttribute("muted", "");
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
      img.alt = "";
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
    const speed = (r.speed || 5) * fps;      // frames of footage per real second
    const jump = (r.jump || 5) * fps;        // beyond this distance: crossfade
    const canvas = el("canvas");
    const ctx = canvas.getContext("2d");
    box.append(canvas);
    document.body.classList.add("rig");

    // Locked X axis across the screen, with a double-arrow handle riding it.
    // The handle sits wherever his head actually is, so it lags like a drag.
    const axis = el("div", "x-axis");
    const handle = el("div", "x-handle");
    handle.innerHTML = '<svg viewBox="0 0 120 50" aria-hidden="true">' +
      '<path d="M3 25 32 3v12h56V3l29 22-29 22V35H32v12z"/></svg><b>CTRL_head · X lock</b><i></i>';
    const readout = handle.querySelector("i");
    document.body.append(axis, handle);

    const poster = new Image();
    poster.src = h.media;
    const frames = Array.from({ length: n }, (_, i) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `${r.path}f_${String(i).padStart(3, "0")}.${r.ext || "webp"}`;
      return img;
    });

    // object-fit: cover, anchored by r.focus so he never gets cropped away
    let fit = null;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      fit = null;
    };
    const cover = (img) => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (fit && fit.iw === iw && fit.ih === ih) return fit;
      const s = Math.max(canvas.width / iw, canvas.height / ih);
      const [fx, fy] = r.focus || [0.5, 0.5];
      const w = iw * s, hgt = ih * s;
      fit = { x: (canvas.width - w) * fx, y: (canvas.height - hgt) * fy, w, h: hgt, iw, ih };
      return fit;
    };
    size();
    addEventListener("resize", size);

    const ready = (img) => img && img.complete && img.naturalWidth;
    const draw = (img, alpha) => {
      if (!ready(img)) return false;
      const f = cover(img);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, f.x, f.y, f.w, f.h);
      return true;
    };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    // Frames that show the requested pose (one per sweep of that column)
    const targets = (tx, ty) => {
      // Sweep mode: one left → right turn, cursor X only
      if (sweep) return [clamp(sweep[0] + (sweep[1] - sweep[0]) * clamp(tx, 0, 1), 0, n - 1)];
      const [top, bottom, top2] = cols[clamp(Math.floor(tx * cols.length), 0, cols.length - 1)];
      const y = clamp(ty, 0, 1);
      const out = [top + (bottom - top) * y];
      if (top2 != null) out.push(top2 - (top2 - bottom) * y);
      return out.map((f) => clamp(f, 0, n - 1));
    };
    // Frames showing the same pose as f (itself, plus its twin in the other sweep)
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

    let head = target(0.5, 0.5), from = head, fadeT = 1, last = performance.now(), hold = [0.5, 0.5];
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      let tx, ty;
      if (rail && rail.matches(":hover")) {
        // Choosing a menu item: the character holds still
        tx = hold[0]; ty = hold[1];
      } else if (pointer.moved && !document.hidden) {
        // The rail isn't part of the interactive area: map X across the
        // space to its left (full width when it's the phone bottom bar)
        const rb = rail && rail.getBoundingClientRect();
        const w = rb && rb.height > rb.width ? rb.left : innerWidth;
        tx = pointer.x / w;
        ty = pointer.y / innerHeight;
      } else {
        // Idle / touch: drift slowly between the columns
        const t = now / 1000;
        tx = 0.5 + Math.sin(t * 0.23) * 0.45;
        ty = 0.5 + Math.sin(t * 0.61) * 0.4;
      }
      if (reduceMotion) { tx = 0.5; ty = 0.5; }
      hold = [tx, ty];
      const [start, want] = route(tx, ty);
      head = start;                          // hop to the twin frame (same pose)
      const gap = want - head;
      // Separate clips per column (r.linked === false): no footage between
      // columns, so switching column is always a crossfade
      const switched = r.linked === false && colOf(want) !== colOf(head);
      if (switched || Math.abs(gap) > jump) {
        from = head; head = want; fadeT = 0;
      } else {
        // ease in, capped travel speed: a rig being dragged through its keys
        head += clamp(gap * Math.min(1, dt * 9), -speed * dt, speed * dt);
      }
      fadeT = Math.min(1, fadeT + dt / 0.22);

      const cur = frames[Math.round(head)];
      if (fadeT < 1) {
        if (!draw(frames[Math.round(from)], 1)) draw(poster, 1);
        draw(cur, fadeT);
      } else if (!draw(cur, 1)) draw(poster, 1);
      window.hvRigState = { head, want, fadeT };
      if (sweep) {
        const rb = rail && rail.getBoundingClientRect();
        const w = rb && rb.height > rb.width ? rb.left : innerWidth;
        const p = clamp((head - sweep[0]) / (sweep[1] - sweep[0]), 0, 1);
        axis.style.width = `${w}px`;
        handle.style.transform = `translate(${p * w}px, 0)`;
        readout.textContent = `X ${(p * 2 - 1).toFixed(2)}`;
      }
      requestAnimationFrame(tick);
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
  const linkCta = (s) => {
    const a = el("a", "link-cta", s.ctaLabel);
    a.href = href(s.ctaHref || "page.html?s=contact");
    return a;
  };
  const bigCta = (s) => {
    if (!s.ctaLabel) return null;
    const a = el("a", "big-cta reveal", s.ctaLabel);
    a.href = href(s.ctaHref || "page.html?s=contact");
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

  const LAYOUTS = { showcase, timeline, tickets, builder, grid, list };

  function renderSection(c, s) {
    document.title = `${s.nav || s.title} — ${c.site.name}`;
    const items = s.items || [];
    // "auto" (or unknown) = grid when entries have images, list otherwise
    const layout = LAYOUTS[s.layout] ? s.layout : items.some((it) => it.image) ? "grid" : "list";
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
        logo.src = it.image; logo.alt = ""; logo.loading = "lazy";
        name.append(logo);
      }
      name.append(el("span", "", it.title || ""));
      const side = el("div", "roster-side");
      if (isNow(it)) side.append(el("span", "now", s.nowLabel || "Now teaching"));
      if (it.subtitle) side.append(el("span", "role", it.subtitle));
      if (it.meta && !/^\s*(present|now|current)\s*$/i.test(it.meta)) side.append(el("span", "years", it.meta));
      row.append(name, side);
      if (it.description) row.append(el("p", "roster-desc", it.description));

      if (it.campus) {
        row.classList.add("has-campus");
        side.append(Object.assign(el("span", "campus-hint"), { title: "Hover to see the campus" }));
        side.lastChild.append(window.hvIcon("image"), el("span", "", "Campus"));
        // Touch screens: the photo unrolls inline when scrolled into view
        const inline = el("figure", "campus-inline");
        const img = el("img");
        img.src = it.campus; img.alt = it.campusCaption || it.title; img.loading = "lazy";
        inline.append(img, el("figcaption", "", [it.campusCaption, it.campusCredit].filter(Boolean).join(" — ")));
        row.append(inline);
        row.addEventListener("pointerenter", (e) => {
          if (e.pointerType !== "mouse") return;
          fImg.src = it.campus;
          fImg.alt = it.campusCaption || it.title;
          fCap.textContent = [it.campusCaption, it.campusCredit].filter(Boolean).join(" — ");
          float.classList.add("show");
        });
        row.addEventListener("pointerleave", () => float.classList.remove("show"));
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
      { value: since ? new Date().getFullYear() - since : null, label: "Years in production", plus: true },
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
        if (video) tile.addEventListener("click", (e) => { e.preventDefault(); lightbox(video, it.title); });
      }
      const media = el("div", "tile-media tilt");
      if (it.image) {
        const img = el("img");
        img.src = it.image; img.alt = it.title || ""; img.loading = "lazy";
        media.append(img);
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

  function lightbox(src, title) {
    const box = el("div", "lightbox");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", title || "Video");
    const frame = el("div", "lightbox-frame");
    const iframe = el("iframe");
    Object.assign(iframe, { src, title: title || "Video", allow: "autoplay; fullscreen; picture-in-picture", allowFullscreen: true });
    frame.append(iframe);
    const close = el("button", "lightbox-close", "Close ✕");
    close.type = "button";
    box.append(frame, close);
    const done = () => {
      box.classList.remove("open");
      setTimeout(() => box.remove(), 300);
      removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") done(); };
    box.addEventListener("click", (e) => { if (e.target === box) done(); });
    close.addEventListener("click", done);
    addEventListener("keydown", onKey);
    document.body.append(box);
    requestAnimationFrame(() => box.classList.add("open"));
    close.focus();
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

  // Cursor ring that grows over anything clickable and can carry a label ("Play", "Open")
  function cursor() {
    if (!finePointer || reduceMotion) return;
    const ring = el("div", "cursor");
    const label = el("span");
    ring.append(label);
    document.body.append(ring);
    // On the rig landing the cursor is just a small free dot; the X-lock
    // handle on the axis (drawn by rigHero) shows what it's driving
    if (document.body.classList.contains("rig")) ring.classList.add("rig-dot");
    let x = pointer.x, y = pointer.y;
    const tick = () => {
      x += (pointer.x - x) * 0.2;
      y += (pointer.y - y) * 0.2;
      ring.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
    })
    .catch((err) => {
      console.error(err);
      document.body.insertAdjacentHTML("beforeend", '<p class="missing" style="position:fixed;inset:40% 0 auto;text-align:center">Could not load content.</p>');
    });
})();
