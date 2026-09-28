// Line icons (24×24, 1.5 stroke). Shared by the site and the admin panel.
window.HV_ICONS = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  university: "M12 4 2 9l10 5 10-5zM6 11.2V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.8M21.5 9.2v5.3",
  briefcase: "M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18M11 13v2h2v-2",
  presentation: "M3 4h18M4.5 4v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V4M12 15v3M8.5 21l3.5-3 3.5 3M8 11l2.5-2.5 2 2L16 7",
  portfolio: "M7 3h12a2 2 0 0 1 2 2v12M4 7h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM3 18l4-4 3 3 2-2 5 5",
  mentor: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16.5 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.4 3 5.2",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4z",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 6.5l9 6.5 9-6.5",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4",
  image: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 16l5-5 5 5 3-3 5 5M15.5 9.5h.01",
  play: "M7 4.5v15l12-7.5z",
  pen: "M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  book: "M4 5h5a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4zM20 5h-5a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H20z",
  award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 12.5 7 21l5-3 5 3-1.5-8.5",
  spark: "M12 4c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z",
};

// Sensible icon per built-in section, so nothing ever falls back to a blank shape
window.HV_DEFAULT_ICONS = {
  home: "home", universities: "university", industry: "briefcase", workshops: "presentation",
  portfolio: "portfolio", classes: "mentor", projects: "cube", contact: "send",
};

window.hvIcon = (name, id) => {
  const icons = window.HV_ICONS;
  const key = icons[name] ? name : window.HV_DEFAULT_ICONS[id] || "spark";
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", icons[key]);
  svg.append(path);
  return svg;
};
