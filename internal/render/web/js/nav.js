// Keyboard/hash-driven navigation between .screen elements. Owns nothing
// outside the deck itself — theme and live-reload are separate modules
// (theme.js, live-reload.js) wired up independently by main.js.
export function init() {
  const screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  if (screens.length === 0) return;

  const counter = document.getElementById("counter");
  let current = 0;

  function indexFromHash() {
    const m = location.hash.match(/^#\/(\d+)$/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return n >= 0 && n < screens.length ? n : 0;
  }

  // .active is the visible screen; .prev marks everything before it, so
  // viewer.css can slide those in from the left instead of the right —
  // screens after "current" get neither class, which is the default
  // "parked off-screen to the right" state.
  function render() {
    screens.forEach(function (s, idx) {
      s.classList.toggle("active", idx === current);
      s.classList.toggle("prev", idx < current);
    });
    history.replaceState(null, "", "#/" + current);
    if (counter) counter.textContent = (current + 1) + " / " + screens.length;
  }

  function show(i) {
    current = Math.max(0, Math.min(screens.length - 1, i));
    render();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      show(current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(current - 1);
    } else if (e.key === "Home") {
      show(0);
    } else if (e.key === "End") {
      show(screens.length - 1);
    }
  });

  window.addEventListener("hashchange", function () {
    show(indexFromHash());
  });

  show(indexFromHash());
}
