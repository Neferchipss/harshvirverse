(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const pad = (i) => String(i + 1).padStart(2, "0");

  // ?preview=1 reads a draft the admin panel saved in this browser
  async function loadContent() {
    if (new URLSearchParams(location.search).has("preview")) {
      try {
        const draft = localStorage.getItem("hv-draft");
        if (draft) return JSON.parse(draft);
      } catch (_) {}
    }
    const res = await fetch("content/content.json?v=" + Date.now());
    return res.json();
  }

  function render(c) {
    document.querySelectorAll("[data-bind]").forEach((n) => {
      n.textContent = get(c, n.dataset.bind) ?? "";
    });
    document.title = `${c.site.name} — ${c.site.roles.slice(0, 2).join(" · ")}`;
    $('meta[name="description"]').content = c.site.metaDescription || "";

    const roles = c.site.roles.join(" × ");
    $("#brand-roles").textContent = c.site.roles.join(" | ");
    $("#hero-roles").textContent = roles;
    $("#hero-card-roles").textContent = roles;

    for (const [id, cta] of [["#cta-primary", c.hero.primaryCta], ["#cta-secondary", c.hero.secondaryCta]]) {
      const a = $(id);
      a.hidden = !cta?.label;
      if (cta) { a.textContent = cta.label; a.href = cta.href || "#"; }
    }

    renderHeroMedia(c.hero);

    const nav = $("#nav-links");
    nav.replaceChildren();
    const home = el("a", "active", "Home");
    home.href = "#top";
    nav.append(home);
    for (const s of c.sections) {
      const a = el("a", "", s.nav || s.title);
      a.href = "#" + s.id;
      nav.append(a);
    }
    const ca = el("a", "", "Contact");
    ca.href = "#contact";
    nav.append(ca);

    const grid = $("#overview-grid");
    grid.replaceChildren();
    c.sections.forEach((s, i) => {
      const a = el("a", "ov-card reveal");
      a.href = "#" + s.id;
      a.append(el("span", "num", pad(i)), el("h3", "", s.nav || s.title), el("p", "", s.summary || ""), el("span", "more", "Explore →"));
      grid.append(a);
    });

    const wrap = $("#sections");
    wrap.replaceChildren();
    for (const s of c.sections) wrap.append(renderSection(s));

    const lines = $("#contact-lines");
    lines.replaceChildren();
    if (c.contact.email) {
      const a = el("a", "", c.contact.email);
      a.href = "mailto:" + c.contact.email;
      lines.append(a);
    }
    if (c.contact.phone) {
      const a = el("a", "", c.contact.phone);
      a.href = "tel:" + c.contact.phone.replace(/\s/g, "");
      lines.append(a);
    }
    if (c.contact.location) lines.append(el("span", "", c.contact.location));

    const socials = $("#socials");
    socials.replaceChildren();
    for (const s of c.site.socials || []) {
      if (!s.url) continue;
      const a = el("a", "btn btn-ghost btn-sm", s.label);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      socials.append(a);
    }

    $("#year").textContent = new Date().getFullYear();
  }

  function renderSection(s) {
    const sec = el("section", "block");
    sec.id = s.id;
    const head = el("div", "block-head reveal");
    const left = el("div");
    left.append(el("p", "eyebrow", s.eyebrow || s.nav), el("h2", "", s.title));
    if (s.intro) left.append(el("p", "intro", s.intro));
    head.append(left);
    if (s.ctaLabel) {
      const a = el("a", "btn btn-primary", s.ctaLabel);
      a.href = s.ctaHref || "#contact";
      head.append(a);
    }
    const cards = el("div", "cards");
    (s.items || []).forEach((it) => {
      const card = el(it.link ? "a" : "div", "card reveal");
      if (it.link) { card.href = it.link; card.target = "_blank"; card.rel = "noopener"; }
      const media = el("div", "card-media");
      if (it.image) {
        const img = el("img");
        img.src = it.image;
        img.alt = it.title || "";
        img.loading = "lazy";
        media.append(img);
      } else {
        media.classList.add("empty");
        media.textContent = (it.title || "?").trim().charAt(0).toUpperCase();
      }
      const body = el("div", "card-body");
      body.append(el("h3", "", it.title || ""));
      if (it.subtitle) body.append(el("span", "card-sub", it.subtitle));
      if (it.meta) body.append(el("span", "card-meta", it.meta));
      if (it.description) body.append(el("p", "card-desc", it.description));
      card.append(media, body);
      cards.append(card);
    });
    sec.append(head, cards);
    return sec;
  }

  /* Hero: cursor-reactive media.
     Video: cursor X scrubs the clip (left edge = first frame, right edge = last frame),
     so a "looking left → right" clip makes him follow the cursor.
     Image: subtle parallax until the video exists. */
  function renderHeroMedia(h) {
    const box = $("#hero-media");
    box.replaceChildren();
    if (!h.media) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0.5, current = 0.5;

    const hero = $("#hero");
    const onMove = (x) => { target = Math.min(1, Math.max(0, x / innerWidth)); };
    hero.addEventListener("pointermove", (e) => onMove(e.clientX));
    hero.addEventListener("pointerleave", () => { target = 0.5; });

    if (h.mediaType === "video") {
      const v = el("video");
      Object.assign(v, { src: h.media, muted: true, playsInline: true, preload: "auto" });
      v.setAttribute("muted", "");
      box.append(v);
      let seeking = false;
      v.addEventListener("seeked", () => { seeking = false; });
      v.addEventListener("loadedmetadata", () => { v.currentTime = v.duration / 2; });
      const tick = () => {
        current += (target - current) * 0.12;
        if (!reduce && v.duration && !seeking && Math.abs(v.currentTime - current * v.duration) > 1 / 60) {
          seeking = true;
          v.currentTime = current * (v.duration - 0.05);
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
      let ty = 0.5;
      hero.addEventListener("pointermove", (e) => { ty = e.clientY / innerHeight; });
      const tick = () => {
        current += (target - current) * 0.08;
        img.style.transform = `scale(1.08) translate(${(current - 0.5) * -24}px, ${(ty - 0.5) * -14}px)`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function wireUi() {
    const nav = $(".nav");
    const toggle = $(".nav-toggle");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    $("#nav-links").addEventListener("click", (e) => {
      if (e.target.tagName === "A") nav.classList.remove("open");
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

    const links = [...document.querySelectorAll("#nav-links a")];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.id === "hero" ? "top" : e.target.id;
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("#hero, .block, #contact").forEach((s) => spy.observe(s));
  }

  loadContent()
    .then((c) => { render(c); wireUi(); })
    .catch((err) => {
      console.error(err);
      document.body.insertAdjacentHTML("afterbegin", '<p style="padding:100px 24px;color:#f07a3a">Could not load content.</p>');
    });
})();
