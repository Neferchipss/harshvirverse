/*! Harshvir Run — conversion / perk / theme config (edit freely; loaded before harshvir-run.js). */
(function (global) {
  "use strict";

  global.HV_RUN_CONFIG = {
    catName: "Pip",
    unlockScore: 500,
    code: "HVRUN500",
    /* Checkout validates this code and expiry before creating payment links. */
    codeNote:
      "Apply this code for ₹500 off Character Concept Art Brushes at Asset Bay checkout (₹1000 → ₹500).",
    /* Optional expiry (ISO date). Empty string = no expiry shown. */
    codeExpiresISO: "2026-12-05",
    challengeScore: 1200,
    siteUrl: "https://harshvirverse.com/",
    tipUrl: "tips/run-tip.html",
    tipMinTokens: 3,
    maxTokensPerRun: 5,

    /* theme: "default" | "diwali" | "packDrop" — or leave "auto" to pick by date windows below */
    theme: "default",
    themeWindows: [
      /* Example: { id: "diwali", start: "2026-10-20", end: "2026-11-10" }, */
      /* Example: { id: "packDrop", start: "2026-11-15", end: "2026-11-30" }, */
    ],

    loreTips: [
      "Pip says: jump like timing in animation — early is late, late is early.",
      "Hold the garden in your head: silhouette first, detail second.",
      "One clean hop beats ten frantic ones. Same in a client review.",
      "Watch the easel — composition leads, color follows.",
      "Creators who keep building get the high score that matters.",
      "404 stones are just redirects. Find the next path.",
    ],

    ctaBySource: {
      secret: {
        primary: {
          id: "book_1on1",
          label: "Book a 1:1",
          href: "page.html?s=classes",
        },
        secondary: {
          id: "asset_bay",
          label: "Browse Asset Bay",
          href: "page.html?s=shop",
        },
      },
      "404": {
        primary: {
          id: "asset_bay",
          label: "Browse Asset Bay",
          href: "page.html?s=shop",
        },
        secondary: {
          id: "home_map",
          label: "Back to the map",
          href: "./",
        },
        tertiary: {
          id: "classes",
          label: "See classes",
          href: "page.html?s=classes",
        },
      },
    },

    billboard: {
      label: "1:1 slots open",
      href: "page.html?s=contact",
      sub: "Mentorship with Harshvir — say hi",
    },

    themes: {
      default: {
        skyTop: "#7ec8f5",
        skyBot: "#c8e8ff",
        grass: "#6bcb3a",
        grassDark: "#4fa82a",
        grassLite: "#8fe05a",
        sakura: "#f7b6c8",
        sakuraDeep: "#e8899e",
        petalA: "#f7b6c8",
        petalB: "#e8899e",
        title: "#f5d04a",
        overlayBg: "radial-gradient(80% 70% at 50% 20%, #b8e0ffcc 0%, #7ec8f5aa 40%, #5aa86899 100%)",
        pageBg: "linear-gradient(180deg, #7ec8f5 0%, #c8e8ff 42%, #9ed96a 42%, #6bcb3a 100%)",
      },
      diwali: {
        skyTop: "#2a1848",
        skyBot: "#f07840",
        grass: "#3a8a2a",
        grassDark: "#2a6a1a",
        grassLite: "#5aad3a",
        sakura: "#ffd060",
        sakuraDeep: "#ff8040",
        petalA: "#ffd060",
        petalB: "#ff6040",
        title: "#ffd060",
        overlayBg: "radial-gradient(80% 70% at 50% 20%, #f07840cc 0%, #2a1848bb 55%, #1a0a30cc 100%)",
        pageBg: "linear-gradient(180deg, #2a1848 0%, #f07840 38%, #3a8a2a 38%, #2a6a1a 100%)",
      },
      packDrop: {
        skyTop: "#4a90c8",
        skyBot: "#e8f4ff",
        grass: "#5aba4a",
        grassDark: "#3a8a2a",
        grassLite: "#7ad868",
        sakura: "#7ec8ff",
        sakuraDeep: "#50a0e8",
        petalA: "#a8e0ff",
        petalB: "#50a0e8",
        title: "#7ec8ff",
        overlayBg: "radial-gradient(80% 70% at 50% 20%, #a8e0ffcc 0%, #4a90c8aa 45%, #3a8a6899 100%)",
        pageBg: "linear-gradient(180deg, #4a90c8 0%, #e8f4ff 42%, #5aba4a 42%, #3a8a2a 100%)",
      },
    },
  };
})(window);
