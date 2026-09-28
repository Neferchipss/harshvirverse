// Line icons (24×24, stroke). Shared by the site and the admin panel.
window.HV_ICONS = {
  home: "M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6",
  university: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6",
  briefcase: "M3 7h18v13H3zM8 7V4h8v3M3 12h18",
  presentation: "M2 4h20M4 4v11h16V4M12 15v5M8 20h8",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  mentor: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5",
  cube: "M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  image: "M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M15.5 9a1.5 1.5 0 1 0 0-.01",
  play: "M6 4l14 8-14 8z",
  pen: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3",
  star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
};

window.hvIcon = (name) => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", window.HV_ICONS[name] || window.HV_ICONS.circle);
  svg.append(path);
  return svg;
};
