// Theme Manager for mdslides Website
// Supports Dark & Light modes with localStorage persistence and OS auto-detection.

const STORAGE_KEY = "mdslides-web-theme";

export function getPreferredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch (e) {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    /* ignore */
  }
}

export function initTheme() {
  // Apply saved or default theme
  const initial = getPreferredTheme();
  setTheme(initial);

  const toggleBtn = document.getElementById("theme-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }

  // Listen for OS system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? "dark" : "light");
      }
    } catch (err) {
      /* ignore */
    }
  });
}
