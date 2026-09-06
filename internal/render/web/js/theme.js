// Light/dark theme toggle. tokens.css already follows the OS via
// prefers-color-scheme with no JS at all; this module only handles the
// *explicit override* — clicking the button, and remembering that choice
// across reloads (this viewer reloads itself on every file save).
const STORAGE_KEY = "mdslides-theme";

function apply(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function currentlyDark() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function init() {
  // localStorage can throw (private browsing, disabled storage) — a
  // failed read/write here should never break the deck, just the
  // "remember my choice across reloads" nicety.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) apply(saved);
  } catch (e) {
    /* ignore */
  }

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", function () {
    const next = currentlyDark() ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
  });
}
