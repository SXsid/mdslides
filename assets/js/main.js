// Main Application Entrypoint for mdslides Website
import { initTheme } from "./theme.js";
import { initSimulator } from "./simulator.js";
import { initInstaller } from "./installer.js";

function initClipboardCopy() {
  const copyButtons = document.querySelectorAll("[data-copy-target]");

  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const targetSelector = button.getAttribute("data-copy-target");
      const targetElement = document.querySelector(targetSelector);
      if (!targetElement) return;

      const textToCopy = targetElement.textContent.trim();

      try {
        await navigator.clipboard.writeText(textToCopy);

        // Visual feedback
        const originalHTML = button.innerHTML;
        button.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        button.setAttribute("title", "Copied to clipboard!");

        const feedbackSpan = button.parentElement.querySelector(".copy-feedback");
        if (feedbackSpan) {
          feedbackSpan.style.display = "block";
        }

        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.setAttribute("title", "Copy to clipboard");
          if (feedbackSpan) {
            feedbackSpan.style.display = "none";
          }
        }, 2200);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    });
  });
}

// Initialize components on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSimulator();
  initInstaller();
  initClipboardCopy();
});
