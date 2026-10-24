/**
 * Hash router for UI mockups — works under file:// (Cursor Simple Browser)
 * and http://. Screens are <section data-screen="id"> inside index.html.
 */
(function () {
  const SCREENS = [
    "home",
    "title",
    "loading",
    "hub",
    "garage",
    "shop",
    "countdown",
    "race-hud",
    "pause",
    "results",
    "settings",
  ];

  const ESC_MAP = {
    loading: "home",
    hub: "home",
    garage: "hub",
    shop: "hub",
    countdown: "hub",
    "race-hud": "pause",
    pause: "race-hud",
    results: "hub",
    settings: null, // resolved dynamically
  };

  const CONFIRM_MAP = {
    title: "loading",
    hub: "garage",
    "hub-pad": "countdown",
    results: "hub",
  };

  function parseHash() {
    const raw = (location.hash || "#home").slice(1);
    const [id, query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    return { id: id || "home", params };
  }

  function go(id, params) {
    let hash = id;
    if (params && [...params].length) {
      hash += "?" + params.toString();
    }
    location.hash = hash;
  }

  function showScreen(id, params) {
    const screenId = SCREENS.includes(id) ? id : "home";
    document.querySelectorAll("[data-screen]").forEach((el) => {
      const on = el.getAttribute("data-screen") === screenId;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });

    document.title =
      screenId === "home"
        ? "Brick Racer — Maquettes UI"
        : screenId + " — Brick Racer";

    const label = document.getElementById("chrome-screen");
    if (label) label.textContent = screenId;

    // Hub prompt variants
    if (screenId === "hub") {
      const prompt = params.get("prompt") || "garage";
      const pg = document.getElementById("prompt-garage");
      const pp = document.getElementById("prompt-pad");
      const dlg = document.getElementById("hub-dialogue");
      if (pg) pg.hidden = prompt !== "garage";
      if (pp) pp.hidden = prompt !== "pad";
      if (dlg) dlg.hidden = prompt !== "dialogue";
      document.body.dataset.hubPrompt = prompt;
    }

    // Settings back target
    if (screenId === "settings") {
      const from = params.get("from") || "title";
      document.body.dataset.settingsFrom = from;
      const back = document.getElementById("settings-back");
      const hint = document.getElementById("esc-hint");
      if (back) {
        back.setAttribute("data-go", from === "pause" ? "pause" : "title");
        back.textContent = "Retour";
      }
      if (hint) hint.textContent = "Esc → " + (from === "pause" ? "pause" : "title");
    }

    // Loading auto-advance
    if (screenId === "loading") {
      window.clearTimeout(window.__mocupLoadTimer);
      window.__mocupLoadTimer = window.setTimeout(() => go("hub"), 2600);
    } else {
      window.clearTimeout(window.__mocupLoadTimer);
    }

    // Countdown sequence
    if (screenId === "countdown") {
      startCountdown();
    } else {
      window.clearTimeout(window.__mocupCountTimer);
    }

    // Toast fade on race HUD
    if (screenId === "race-hud") {
      const toast = document.getElementById("hex-toast");
      if (toast) {
        toast.style.opacity = "1";
        window.setTimeout(() => {
          toast.style.transition = "opacity 300ms ease";
          toast.style.opacity = "0";
        }, 2000);
      }
    }
  }

  function startCountdown() {
    window.clearTimeout(window.__mocupCountTimer);
    const el = document.querySelector("[data-countdown]");
    if (!el) return;
    const steps = ["3", "2", "1", "GO"];
    let i = 0;
    const tick = () => {
      el.textContent = steps[i];
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
      i += 1;
      if (i < steps.length) {
        window.__mocupCountTimer = window.setTimeout(tick, 750);
      } else {
        window.__mocupCountTimer = window.setTimeout(() => go("race-hud"), 600);
      }
    };
    tick();
  }

  function route() {
    const { id, params } = parseHash();
    showScreen(id, params);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-go]");
    if (!link) return;
    event.preventDefault();
    const target = link.getAttribute("data-go");
    const prompt = link.getAttribute("data-prompt");
    const from = link.getAttribute("data-from");
    const params = new URLSearchParams();
    if (prompt) params.set("prompt", prompt);
    if (from) params.set("from", from);
    go(target, params);
  });

  window.addEventListener("keydown", (event) => {
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const { id, params } = parseHash();

    if (event.key === "Escape") {
      event.preventDefault();
      if (id === "settings") {
        go(document.body.dataset.settingsFrom === "pause" ? "pause" : "title");
        return;
      }
      const dest = ESC_MAP[id];
      if (dest) go(dest);
      return;
    }

    if (event.key === "Enter" || event.key === "e" || event.key === "E") {
      let key = id;
      if (id === "hub" && params.get("prompt") === "pad") key = "hub-pad";
      if (id === "hub" && params.get("prompt") === "dialogue") return;
      const dest = CONFIRM_MAP[key];
      if (dest) {
        event.preventDefault();
        go(dest);
      }
    }
  });

  window.addEventListener("hashchange", route);

  if (!location.hash) {
    location.hash = "#home";
  }
  route();
})();
