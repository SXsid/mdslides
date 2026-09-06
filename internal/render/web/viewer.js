// Keyboard-driven navigation between .screen elements, plus a live-reload
// client. No framework, no build step — this ships as a static file
// embedded straight into the mdslides binary.
(function () {
  var screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  if (screens.length === 0) return;

  var counter = document.getElementById("counter");
  var current = 0;

  function indexFromHash() {
    var m = location.hash.match(/^#\/(\d+)$/);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    return n >= 0 && n < screens.length ? n : 0;
  }

  function show(i) {
    current = Math.max(0, Math.min(screens.length - 1, i));
    screens.forEach(function (s, idx) {
      s.classList.toggle("active", idx === current);
    });
    history.replaceState(null, "", "#/" + current);
    if (counter) counter.textContent = (current + 1) + " / " + screens.length;
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

  // The server pushes a message on /events whenever the source Markdown
  // file changes on disk; just reload to pick up the new render.
  if (typeof EventSource !== "undefined") {
    var source = new EventSource("/events");
    source.onmessage = function () {
      location.reload();
    };
  }
})();
