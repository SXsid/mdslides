// Keyboard shortcuts dialog manager.
// Opens with '?' key or the HUD help button; closes with Escape or clicking the backdrop.
export function init() {
  const dialog = document.getElementById("shortcuts-dialog");
  const openBtn = document.getElementById("shortcuts-toggle");
  const closeBtn = document.getElementById("shortcuts-close");

  if (!dialog) return;

  function open() {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function close() {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  if (openBtn) {
    openBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      open();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", close);
  }

  // Close when clicking dialog backdrop
  dialog.addEventListener("click", function (e) {
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      close();
    }
  });

  // Shortcut key '?'
  document.addEventListener("keydown", function (e) {
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (dialog.open) {
        close();
      } else {
        open();
      }
    }
  });
}
