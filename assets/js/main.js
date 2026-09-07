// Main Application Entrypoint for mdslides Website

async function copyToClipboard(text) {
  // Try modern Clipboard API if supported and in secure context
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fall through to fallback
    }
  }

  // Fallback for file://, older browsers, or non-secure contexts
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    return false;
  }
}

function initClipboardCopy() {
  document.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-copy-target]");
    if (!button) return;

    const targetSelector = button.getAttribute("data-copy-target");
    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) return;

    const textToCopy = targetElement.textContent.trim();
    const success = await copyToClipboard(textToCopy);

    if (success) {
      const originalHTML = button.innerHTML;
      const isSlideBtn = button.classList.contains("slide-copy-btn");

      button.classList.add("copied");
      if (isSlideBtn) {
        button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>`;
      } else {
        button.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      }
      button.setAttribute("title", "Copied to clipboard!");

      const feedbackSpan = button.parentElement.querySelector(".copy-feedback");
      if (feedbackSpan) {
        feedbackSpan.style.display = "block";
      }

      setTimeout(() => {
        button.classList.remove("copied");
        button.innerHTML = originalHTML;
        button.setAttribute("title", "Copy to clipboard");
        if (feedbackSpan) {
          feedbackSpan.style.display = "none";
        }
      }, 2000);
    }
  });
}

// Initialize all components when DOM is ready
function boot() {
  if (typeof window.initTheme === "function") window.initTheme();
  if (typeof window.initSimulator === "function") window.initSimulator();
  if (typeof window.initInstaller === "function") window.initInstaller();
  initClipboardCopy();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
