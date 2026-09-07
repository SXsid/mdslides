// Keyboard, button, and hash-driven navigation between .screen elements.
// Handles slide progress bar, fullscreen toggle, and history updates.
export function init() {
  const screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  if (screens.length === 0) return;

  const counter = document.getElementById("counter");
  const progressBar = document.getElementById("progress-bar");
  const prevBtn = document.getElementById("nav-prev");
  const nextBtn = document.getElementById("nav-next");
  const fullscreenBtn = document.getElementById("fullscreen-toggle");

  let current = 0;

  function indexFromHash() {
    const m = location.hash.match(/^#\/(\d+)$/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return n >= 0 && n < screens.length ? n : 0;
  }

  function render() {
    screens.forEach(function (s, idx) {
      s.classList.toggle("active", idx === current);
      s.classList.toggle("prev", idx < current);
    });

    history.replaceState(null, "", "#/" + current);

    if (counter) {
      counter.textContent = (current + 1) + " / " + screens.length;
    }

    if (progressBar) {
      const progressPercent = screens.length > 1 ? (current / (screens.length - 1)) * 100 : 100;
      progressBar.style.width = progressPercent + "%";
      progressBar.setAttribute("aria-valuenow", Math.round(progressPercent));
    }

    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === screens.length - 1;
  }

  function show(i) {
    current = Math.max(0, Math.min(screens.length - 1, i));
    render();
  }

  // Keyboard navigation
  document.addEventListener("keydown", function (e) {
    // If a modal or input has focus, do not intercept slide keys
    if (document.querySelector("dialog[open]") && e.key !== "Escape") {
      return;
    }

    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      show(current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      show(0);
    } else if (e.key === "End") {
      e.preventDefault();
      show(screens.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Buttons in HUD
  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      show(current - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      show(current + 1);
    });
  }

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {
        /* fallback if denied */
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", toggleFullscreen);
  }

  document.addEventListener("fullscreenchange", function () {
    document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });

  window.addEventListener("hashchange", function () {
    show(indexFromHash());
  });

  show(indexFromHash());
}

