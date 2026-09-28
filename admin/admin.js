(() => {
  const CONTENT_PATH = "content/content.json";
  const UPLOAD_DIR = "assets/uploads";
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "class") n.className = v;
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
    }
    n.append(...kids.flat().filter((k) => k != null));
    return n;
  };
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} },
    del: (k) => { try { localStorage.removeItem(k); } catch (_) {} },
  };

  let auth = null;       // { owner, repo, branch, token } — null in offline mode
  let content = null;
  let sha = null;
  let view = "site";
  let dirty = false;
  const localMedia = {}; // uploaded path -> object URL, until GitHub Pages redeploys

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${auth.owner}/${auth.repo}/${path}`, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${auth.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  const b64encodeText = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decodeText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  const fileToB64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  async function loadFromGitHub() {
    const f = await gh(`contents/${CONTENT_PATH}?ref=${encodeURIComponent(auth.branch)}&t=${Date.now()}`);
    sha = f.sha;
    return JSON.parse(b64decodeText(f.content));
  }

  async function save() {
    if (!auth) return toast("You're in try-it mode — sign in to publish.");
    const btn = $("#btn-save");
    btn.disabled = true;
    setStatus("Publishing…");
    try {
      const res = await gh(`contents/${CONTENT_PATH}`, {
        method: "PUT",
        body: JSON.stringify({
          message: "Update site content (admin)",
          content: b64encodeText(JSON.stringify(exportContent(), null, 2) + "\n"),
          sha,
          branch: auth.branch,
        }),
      });
      sha = res.content.sha;
      setDirty(false);
      setStatus("Published — live in about a minute.", "ok");
    } catch (e) {
      setStatus("Publish failed: " + e.message, "err");
      if (e.status === 409) toast("Someone else changed the site since you opened it. Use Backup, then reload.");
    } finally {
      btn.disabled = false;
    }
  }

  async function upload(file) {
    if (!auth) { toast("Sign in to upload files. In try-it mode, paste an image URL instead."); return null; }
    if (file.size > 50 * 1024 * 1024) { toast("That file is over 50 MB — please compress it first."); return null; }
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/-+/g, "-");
    const path = `${UPLOAD_DIR}/${Date.now()}-${safe}`;
    setStatus(`Uploading ${file.name}…`);
    await gh(`contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Upload ${safe} (admin)`, content: await fileToB64(file), branch: auth.branch }),
    });
    localMedia[path] = URL.createObjectURL(file);
    setStatus("Uploaded. Remember to Save & publish.", "dirty");
    return path;
  }

  /* ---------- state helpers ---------- */
  function setStatus(msg, cls = "") {
    const s = $("#status");
    s.textContent = msg;
    s.className = "status " + cls;
  }
  function setDirty(v) {
    dirty = v;
    if (v) setStatus(auth ? "Unsaved changes" : "Try-it mode — changes are not published", "dirty");
    store.set("hv-draft", JSON.stringify(exportContent()));
  }
  function toast(msg) {
    const t = el("div", { class: "toast" }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 4500);
  }
  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, path, val) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
    target[last] = val;
  }
  const mediaUrl = (p) => (!p ? "" : localMedia[p] || (/^(https?:|blob:|data:)/.test(p) ? p : "../" + p));
  const isVideo = (p) => /\.(mp4|webm|mov|m4v)$/i.test(p || "");
  const slug = (s) => (s || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

  /* ---------- field widgets ---------- */
  // spec: [path, label, type?, extra?]  type: text | textarea | media | select
  function field(obj, [path, label, type = "text", extra], onChange) {
    const val = getPath(obj, path) ?? "";
    const commit = (v) => { setPath(obj, path, v); setDirty(true); onChange?.(v); };

    if (type === "textarea") {
      return el("label", { class: "wide" }, label, el("textarea", { oninput: (e) => commit(e.target.value) }, val));
    }
    if (type === "select") {
      const sel = el("select", { onchange: (e) => commit(e.target.value) },
        extra.map((o) => el("option", { value: o, selected: o === val }, o)));
      return el("label", {}, label, sel);
    }
    if (type === "media") {
      const input = el("input", { value: val, placeholder: "Upload a file or paste a URL", oninput: (e) => { commit(e.target.value); refresh(); } });
      const preview = el("div");
      const refresh = () => {
        const v = input.value;
        preview.replaceChildren(v ? (isVideo(v)
          ? el("video", { class: "media-preview", src: mediaUrl(v), muted: true, controls: true })
          : el("img", { class: "media-preview", src: mediaUrl(v), alt: "" })) : "");
      };
      const picker = el("input", {
        type: "file", accept: extra || "image/*", hidden: true,
        onchange: async (e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (!f) return;
          try {
            const p = await upload(f);
            if (p) { input.value = p; commit(p); refresh(); }
          } catch (err) { setStatus("Upload failed: " + err.message, "err"); }
        },
      });
      refresh();
      return el("div", { class: "wide" },
        el("div", { class: "media-field" },
          el("label", {}, label, input),
          el("button", { class: "btn", type: "button", onclick: () => picker.click() }, "Upload"),
          val || input.value ? el("button", { class: "btn btn-link", type: "button", onclick: () => { input.value = ""; commit(""); refresh(); } }, "Clear") : null,
          picker),
        preview);
    }
    return el("label", {}, label, el("input", { value: val, oninput: (e) => commit(e.target.value) }));
  }
  const fields = (obj, specs, onChange) => el("div", { class: "fields" }, specs.map((s) => field(obj, s, onChange)));

  // Editable list of objects (cards) or strings
  function list({ title, arr, specs, blank, label = (it) => it.title || it.label || "Untitled", thumb, addText = "Add" }) {
    const wrap = el("div");
    const openSet = new Set();
    const draw = () => {
      wrap.replaceChildren(
        el("div", { class: "list-head" },
          el("h3", {}, `${title} (${arr.length})`),
          el("button", { class: "btn", onclick: () => { arr.push(structuredClone(blank)); openSet.add(arr.length - 1); setDirty(true); draw(); } }, "+ " + addText)),
        el("div", { class: "items" }, arr.map((it, i) => {
          const head = el("div", { class: "item-head", onclick: () => { openSet.has(i) ? openSet.delete(i) : openSet.add(i); draw(); } },
            thumb ? el("span", { class: "thumb", style: thumb(it) && !isVideo(thumb(it)) ? `background-image:url("${mediaUrl(thumb(it))}")` : "" }) : null,
            el("span", { class: "title" }, label(it)),
            el("span", { class: "ctrl", onclick: (e) => e.stopPropagation() },
              el("button", { class: "btn btn-sm", title: "Move up", disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setDirty(true); draw(); } }, "↑"),
              el("button", { class: "btn btn-sm", title: "Move down", disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; setDirty(true); draw(); } }, "↓"),
              el("button", { class: "btn btn-sm btn-danger", title: "Remove", onclick: () => { if (confirmRemove(label(it))) { arr.splice(i, 1); openSet.clear(); setDirty(true); draw(); } } }, "✕")));
          const body = el("div", { class: "item-body" }, fields(it, specs, () => { head.querySelector(".title").textContent = label(it); }));
          return el("div", { class: "item" + (openSet.has(i) ? " open" : "") }, head, body);
        })));
    };
    draw();
    return wrap;
  }
  const confirmRemove = (name) => window.confirm(`Remove "${name}"? (Nothing is published until you Save.)`);

  /* ---------- views ---------- */
  const ITEM_SPECS = [
    ["title", "Title"], ["subtitle", "Subtitle"], ["meta", "Small detail (year, duration…)"], ["link", "Link (optional)"],
    ["description", "Description", "textarea"], ["image", "Image", "media", "image/*"],
  ];
  const BLANK_ITEM = { title: "New item", subtitle: "", meta: "", description: "", image: "", link: "" };

  const views = {
    site: () => [
      el("h2", {}, "Site & profile"),
      el("p", { class: "hint" }, "Name, roles and links used across the whole site."),
      fields(content.site, [["name", "Full name"], ["initials", "Logo initials"], ["email", "Email"], ["metaDescription", "Search engine description", "textarea"]]),
      list({ title: "Roles", arr: (content.site.roles = content.site.roles.map((r) => (typeof r === "string" ? { label: r } : r))), specs: [["label", "Role"]], blank: { label: "New role" }, addText: "Add role" }),
      list({ title: "Social links", arr: content.site.socials, specs: [["label", "Label"], ["url", "URL"]], blank: { label: "New link", url: "" }, addText: "Add link" }),
    ],
    hero: () => [
      el("h2", {}, "Landing"),
      el("p", { class: "hint" }, "The full-screen character page. Video mode: moving the cursor left→right scrubs the video from its first frame to its last."),
      fields(content.hero, [
        ["headlineTop", "First name"], ["headlineBottom", "Last name"], ["tagline", "Small line under the name"],
        ["mediaType", "Background type", "select", ["image", "video"]],
        ["media", "Background image / video", "media", "image/*,video/mp4,video/webm"],
      ]),
    ],
    contact: () => [
      el("h2", {}, "Contact"),
      fields(content.contact, [["eyebrow", "Small heading"], ["title", "Title"], ["email", "Email"], ["phone", "Phone"], ["location", "Location"], ["text", "Text", "textarea"]]),
    ],
  };

  function sectionView(i) {
    const s = content.sections[i];
    const move = (d) => {
      const j = i + d;
      [content.sections[i], content.sections[j]] = [content.sections[j], content.sections[i]];
      view = "s" + j; setDirty(true); draw();
    };
    return [
      el("h2", {}, s.nav || s.title || "Section"),
      el("p", { class: "hint" }, `Its own page, reached from icon ${i + 2} in the side menu.`),
      fields(s, [
        ["nav", "Menu name (icon tooltip)"], ["icon", "Menu icon", "select", Object.keys(window.HV_ICONS)],
        ["eyebrow", "Small heading"], ["title", "Page title"],
        ["intro", "Intro text", "textarea"], ["ctaLabel", "Link text (optional)"], ["ctaHref", "Link goes to"],
        ["layout", "Entries shown as", "select", ["auto", "grid", "list"]],
      ], () => drawSide()),
      list({ title: "Entries", arr: (s.items ??= []), specs: ITEM_SPECS, blank: BLANK_ITEM, thumb: (it) => it.image, addText: "Add entry" }),
      el("div", { class: "danger-zone" },
        el("button", { class: "btn", disabled: i === 0, onclick: () => move(-1) }, "Move section up"), " ",
        el("button", { class: "btn", disabled: i === content.sections.length - 1, onclick: () => move(1) }, "Move section down"), " ",
        el("button", { class: "btn btn-danger", onclick: () => {
          if (!confirmRemove(s.nav || s.title)) return;
          content.sections.splice(i, 1); view = "site"; setDirty(true); draw();
        } }, "Delete section")),
    ];
  }

  function addSection() {
    const name = window.prompt("Name of the new section (shown in the menu):", "New section");
    if (!name) return;
    const taken = new Set(["hero", "contact", "top", ...content.sections.map((s) => s.id)]);
    let id = slug(name), n = 2;
    while (taken.has(id)) id = `${slug(name)}-${n++}`;
    content.sections.push({ id, nav: name, icon: "spark", eyebrow: name, title: name, intro: "", ctaLabel: "", ctaHref: "page.html?s=contact", layout: "auto", items: [] });
    view = "s" + (content.sections.length - 1);
    setDirty(true); draw();
  }

  function drawSide() {
    const btn = (key, text) => el("button", { class: view === key ? "active" : "", onclick: () => { view = key; draw(); } }, text);
    $("#side").replaceChildren(
      el("h4", {}, "General"), btn("site", "Site & profile"), btn("hero", "Landing"),
      el("h4", {}, "Sections"), ...content.sections.map((s, i) => btn("s" + i, s.nav || s.title || "Section")),
      el("button", { class: "add", onclick: addSection }, "+ Add section"),
      el("h4", {}, "End"), btn("contact", "Contact"));
  }

  function draw() {
    drawSide();
    const nodes = view.startsWith("s") && view !== "site" ? sectionView(+view.slice(1)) : views[view]();
    $("#editor").replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }

  // Roles are edited as objects for the list widget; the site reads plain strings.
  const exportContent = () => {
    const c = structuredClone(content);
    c.site.roles = c.site.roles.map((r) => (typeof r === "string" ? r : r.label)).filter(Boolean);
    return c;
  };

  /* ---------- boot ---------- */
  function start(c) {
    content = c;
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#bar-actions").hidden = false;
    $("#btn-save").hidden = !auth;
    setStatus(auth ? `Connected to ${auth.owner}/${auth.repo}` : "Try-it mode — changes are not published", auth ? "ok" : "dirty");
    draw();
  }

  function guessRepo() {
    const h = location.hostname;
    if (h.endsWith(".github.io")) return { owner: h.split(".")[0], repo: location.pathname.split("/")[1] || h };
    return { owner: "Neferchipss", repo: "harshvirverse" };
  }

  async function login() {
    const errEl = $("#login-err");
    errEl.textContent = "";
    const a = { owner: $("#owner").value.trim(), repo: $("#repo").value.trim(), branch: $("#branch").value.trim() || "main", token: $("#token").value.trim() };
    if (!a.token) { errEl.textContent = "Paste your access token first."; return; }
    auth = a;
    $("#btn-login").disabled = true;
    try {
      const c = await loadFromGitHub();
      store.set("hv-auth", JSON.stringify(a));
      start(c);
    } catch (e) {
      auth = null;
      errEl.textContent = e.status === 401 ? "That token was rejected. Check it and try again."
        : e.status === 404 ? "Can't see the repository — check the owner/repo names and that the token has access to it."
        : "Couldn't connect: " + e.message;
    } finally {
      $("#btn-login").disabled = false;
    }
  }

  async function offline() {
    const res = await fetch("../" + CONTENT_PATH + "?v=" + Date.now());
    start(await res.json());
  }

  $("#btn-login").addEventListener("click", login);
  $("#token").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  $("#btn-offline").addEventListener("click", () => offline().catch((e) => ($("#login-err").textContent = e.message)));
  $("#btn-save").addEventListener("click", save);
  $("#btn-preview").addEventListener("click", () => {
    store.set("hv-draft", JSON.stringify(exportContent()));
    const page = view === "contact" ? "page.html?s=contact&"
      : /^s\d+$/.test(view) ? `page.html?s=${encodeURIComponent(content.sections[+view.slice(1)].id)}&` : "?";
    window.open(`../${page}preview=1`, "_blank");
  });
  $("#btn-download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(exportContent(), null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "content.json" });
    a.click();
  });
  $("#btn-logout").addEventListener("click", () => {
    if (dirty && !window.confirm("You have unsaved changes. Log out anyway?")) return;
    store.del("hv-auth");
    location.reload();
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  const g = guessRepo();
  $("#owner").value = g.owner;
  $("#repo").value = g.repo;
  const saved = store.get("hv-auth");
  if (saved) {
    try {
      const a = JSON.parse(saved);
      Object.entries(a).forEach(([k, v]) => { const i = $("#" + k); if (i) i.value = v; });
      login();
    } catch (_) { store.del("hv-auth"); }
  }
})();
