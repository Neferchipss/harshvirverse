(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const isHome = document.body.classList.contains("home");
  const current = isHome ? "home" : params.get("s") || "";

  // Keep ?preview=1 on internal links so the admin draft follows you around
  const href = (url) => {
    if (!preview || /^(https?:|mailto:|tel:|#)/.test(url)) return url;
    return url + (url.includes("?") ? "&" : "?") + "preview=1";
  };
  const pageUrl = (id) => href(`page.html?s=${encodeURIComponent(id)}`);

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
    document.querySelectorAll("[data-bind]").forEach((n) => { n.textContent = get(c, n.dataset.bind) ?? ""; });
    document.querySelectorAll(".mark").forEach((a) => { a.href = href("./"); });
    $('meta[name="description"]').content = c.site.metaDescription || "";

    const rail = $("#rail");
    const links = [
      { id: "home", label: "Home", icon: "home", url: href("./") },
      ...c.sections.map((s) => ({ id: s.id, label: s.nav || s.title, icon: s.icon, url: pageUrl(s.id) })),
      { id: "contact", label: "Contact", icon: "send", url: pageUrl("contact") },
    ];
    rail.replaceChildren(...links.map((l) => {
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
        a.href = s.url; a.target = "_blank"; a.rel = "noopener";
        return a;
      }));
    }
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------- landing ---------- */
  function renderHome(c) {
    const name = [c.hero.headlineTop, c.hero.headlineBottom].filter(Boolean).join(" ");
    document.title = name || c.site.name;
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
    if (!h.media) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0.5, cur = 0.5, ty = 0.5;
    addEventListener("pointermove", (e) => { target = e.clientX / innerWidth; ty = e.clientY / innerHeight; });
    document.addEventListener("pointerleave", () => { target = 0.5; ty = 0.5; });

    if (h.mediaType === "video") {
      const v = el("video");
      Object.assign(v, { src: h.media, muted: true, playsInline: true, preload: "auto" });
      v.setAttribute("muted", "");
      box.append(v);
      let seeking = false;
      v.addEventListener("seeked", () => { seeking = false; });
      v.addEventListener("loadedmetadata", () => { v.currentTime = v.duration / 2; });
      const tick = () => {
        cur += (target - cur) * 0.12;
        if (!reduce && v.duration && !seeking && Math.abs(v.currentTime - cur * v.duration) > 1 / 60) {
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
      if (reduce) return;
      const tick = () => {
        cur += (target - cur) * 0.06;
        img.style.transform = `scale(1.06) translate(${(cur - 0.5) * -22}px, ${(ty - 0.5) * -12}px)`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* ---------- inner pages ---------- */
  function head(eyebrow, title, intro) {
    const h = el("header", "page-head");
    if (eyebrow) h.append(el("p", "eyebrow", eyebrow));
    h.append(el("h1", "", title || ""));
    if (intro) h.append(el("p", "intro", intro));
    return h;
  }

  function renderSection(c, s) {
    document.title = `${s.nav || s.title} — ${c.site.name}`;
    const h = head(s.eyebrow, s.title, s.intro);
    if (s.ctaLabel) {
      const a = el("a", "link-cta", s.ctaLabel);
      a.href = href(s.ctaHref || "page.html?s=contact");
      h.append(a);
    }
    const items = s.items || [];
    if (s.layout === "showcase") return renderShowcase(s, h, items);
    // layout: "grid" | "list" | anything else = grid when entries have images
    const grid = s.layout === "grid" || (s.layout !== "list" && items.some((it) => it.image));
    const wrap = el("div", grid ? "tiles" : "rows");
    for (const it of items) {
      const node = el(it.link ? "a" : "div", grid ? "tile" : "row");
      if (it.link) { node.href = it.link; node.target = "_blank"; node.rel = "noopener"; }
      if (grid) {
        const media = el("div", "tile-media");
        if (it.image) {
          const img = el("img");
          img.src = it.image; img.alt = it.title || ""; img.loading = "lazy";
          media.append(img);
        } else {
          media.classList.add("empty");
          media.append(window.hvIcon("image"));
        }
        node.append(media, el("h3", "", it.title || ""));
        const sub = [it.subtitle, it.meta].filter(Boolean).join(" · ");
        if (sub) node.append(el("p", "sub", sub));
        if (it.description) node.append(el("p", "desc", it.description));
      } else {
        node.append(el("h3", "", it.title || ""), el("span", "sub", it.subtitle || ""), el("span", "meta", it.meta || ""));
        if (it.description) node.append(el("p", "desc", it.description));
      }
      wrap.append(node);
    }
    $("#page").replaceChildren(h, wrap);
  }

  /* Showcase: stats worked out from the entries, a marquee of names, and a big-type roster.
     An entry counts as current when its "meta" says present / now / current. */
  function renderShowcase(s, h, items) {
    const page = $("#page");
    page.classList.add("wide");
    const isNow = (it) => /present|now|current/i.test(it.meta || "");
    const years = items.flatMap((it) => (it.meta || "").match(/\b(19|20)\d{2}\b/g) || []).map(Number);

    // The text link moves to the big CTA at the bottom
    h.querySelector(".link-cta")?.remove();
    const stats = el("div", "stats");
    const stat = (value, label, plus) => {
      const d = el("div", "stat");
      const b = el("b", "", String(value));
      if (plus) b.append(el("sup", "", "+"));
      d.append(b, el("span", "", label));
      stats.append(d);
    };
    if (items.length) stat(items.length, s.countLabel || "Institutions");
    const now = items.filter(isNow).length;
    if (now) stat(now, s.currentLabel || "Teaching now");
    if (years.length) stat(Math.min(...years), "Since");
    h.append(stats);

    const marquee = el("div", "marquee");
    marquee.setAttribute("aria-hidden", "true");
    const track = el("div", "marquee-track");
    const names = items.map((it) => it.title).filter(Boolean);
    for (let i = 0; i < 2; i++) names.forEach((n) => track.append(el("span", "", n)));
    marquee.append(track);

    const roster = el("div", "roster");
    for (const it of items) {
      const row = el(it.link ? "a" : "div", "roster-row");
      if (it.link) { row.href = it.link; row.target = "_blank"; row.rel = "noopener"; }
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
      roster.append(row);
    }

    const nodes = [h, names.length > 1 ? marquee : null, roster];
    if (s.ctaLabel) {
      const cta = el("a", "big-cta", s.ctaLabel);
      cta.href = href(s.ctaHref || "page.html?s=contact");
      nodes.push(cta);
    }
    page.replaceChildren(...nodes.filter(Boolean));
  }

  function renderContact(c) {
    const k = c.contact;
    document.title = `Contact — ${c.site.name}`;
    const lines = el("div", "contact-lines");
    if (k.email) { const a = el("a", "", k.email); a.href = "mailto:" + k.email; lines.append(a); }
    if (k.phone) { const a = el("a", "", k.phone); a.href = "tel:" + k.phone.replace(/\s/g, ""); lines.append(a); }
    if (k.location) lines.append(el("span", "", k.location));
    $("#page").replaceChildren(head(k.eyebrow, k.title, k.text), lines);
  }

  function renderPage(c) {
    if (current === "contact") return renderContact(c);
    const s = c.sections.find((x) => x.id === current);
    if (s) return renderSection(c, s);
    const back = el("a", "link-cta", "Back home");
    back.href = href("./");
    $("#page").replaceChildren(head("", "Page not found", "That page doesn't exist (anymore)."), back);
  }

  loadContent()
    .then((c) => {
      renderShared(c);
      isHome ? renderHome(c) : renderPage(c);
    })
    .catch((err) => {
      console.error(err);
      document.body.insertAdjacentHTML("beforeend", '<p class="missing" style="position:fixed;inset:40% 0 auto;text-align:center">Could not load content.</p>');
    });
})();
