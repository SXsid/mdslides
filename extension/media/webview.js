// The viewer runtime, adapted from internal/render/web/js/*.js.
//
// The CLI ships those as ES modules that talk to its local HTTP server: an
// EventSource on /events for live reload, and /static/ imports. Neither exists
// here, so the same behaviour is folded into one classic script that a webview
// CSP can admit with a nonce, and live reload becomes a postMessage from the
// extension host that swaps the slides in place instead of reloading the page.
//
// The same file is inlined into standalone HTML exports, which have no
// extension host at all — hence every host interaction being optional.
(function () {
  "use strict";

  var host = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

  var deck = document.getElementById("deck");
  var container = document.getElementById("screens");
  var counter = document.getElementById("counter");
  var progressBar = document.getElementById("progress-bar");
  var prevBtn = document.getElementById("nav-prev");
  var nextBtn = document.getElementById("nav-next");
  var fullscreenBtn = document.getElementById("fullscreen-toggle");
  var emptyState = document.getElementById("empty-state");

  var screens = [];
  var current = 0;

  // ---------------------------------------------------------------- slides

  function collect() {
    screens = Array.prototype.slice.call(container.querySelectorAll(".screen"));
  }

  function render() {
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("active", i === current);
      screens[i].classList.toggle("prev", i < current);
    }

    if (counter) {
      counter.textContent = screens.length ? current + 1 + " / " + screens.length : "0 / 0";
    }

    if (progressBar) {
      var percent = screens.length > 1 ? (current / (screens.length - 1)) * 100 : 100;
      progressBar.style.width = percent + "%";
      progressBar.setAttribute("aria-valuenow", Math.round(percent));
    }

    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current >= screens.length - 1;

    // An empty deck is the normal state of a file someone just started, not an
    // error — say what turns it into slides instead of showing a blank card.
    if (emptyState) emptyState.hidden = screens.length > 0;
    if (deck) deck.hidden = screens.length === 0;

    saveState();
  }

  function show(i, notifyHost) {
    if (screens.length === 0) {
      current = 0;
      render();
      return;
    }
    var next = Math.max(0, Math.min(screens.length - 1, i));
    var changed = next !== current;
    current = next;
    render();
    if (changed && notifyHost && host) {
      host.postMessage({ type: "navigated", index: current });
    }
  }

  function saveState() {
    if (!host) return;
    host.setState({
      uri: document.body.getAttribute("data-source") || "",
      index: current,
    });
  }

  // ----------------------------------------------------------------- theme

  var THEME_MODE = document.body.getAttribute("data-theme-mode") || "auto";
  var override = null; // set by the T key / toggle button, for this session only

  function hostIsDark() {
    var cls = document.body.className || "";
    if (cls.indexOf("vscode-dark") !== -1) return true;
    if (cls.indexOf("vscode-high-contrast") !== -1) {
      return cls.indexOf("vscode-high-contrast-light") === -1;
    }
    if (cls.indexOf("vscode-light") !== -1) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // tokens.css already follows the OS on its own via prefers-color-scheme. The
  // explicit data-theme attribute is only needed to force a choice: the user's
  // mdslides.theme setting, the editor's own theme, or the T-key override.
  function applyTheme() {
    var theme = override;
    if (!theme) {
      if (THEME_MODE === "light" || THEME_MODE === "dark") {
        theme = THEME_MODE;
      } else if (host) {
        theme = hostIsDark() ? "dark" : "light";
      }
    }
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function currentlyDark() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function toggleTheme() {
    override = currentlyDark() ? "light" : "dark";
    applyTheme();
  }

  // The editor's theme can change while the panel is open; its only signal is
  // the class list VS Code maintains on <body>.
  if (host) {
    new MutationObserver(function () {
      if (!override && THEME_MODE === "auto") applyTheme();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // -------------------------------------------------------------- mermaid

  var mermaidLib = null;

  function renderMermaid() {
    if (document.body.getAttribute("data-mermaid") !== "on") return;

    // markdown-it renders a ```mermaid fence as <pre><code class="language-
    // mermaid">. Mermaid wants a plain element whose text is the raw diagram
    // source, so swap each one before handing anything over. textContent, not
    // innerHTML: the fence source is HTML-escaped (--> became --&gt;) and
    // textContent decodes it back to what Mermaid's parser expects.
    var blocks = container.querySelectorAll("pre > code.language-mermaid");
    if (blocks.length === 0) return;

    Array.prototype.forEach.call(blocks, function (code) {
      var div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
    });

    var dark = currentlyDark();
    var run = function (lib) {
      lib.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
      lib.run({ querySelector: "#screens .mermaid" });
    };

    if (mermaidLib) {
      run(mermaidLib);
      return;
    }

    // Pinned, and loaded lazily: a deck with no diagrams never touches the
    // network. This is the one piece that needs internet access, same as the
    // CLI viewer — Mermaid bundles its own layout engine and is far too large
    // to vendor.
    import("https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs")
      .then(function (mod) {
        mermaidLib = mod.default;
        run(mermaidLib);
      })
      .catch(function () {
        // Offline, or the CDN is blocked. The fenced blocks are already gone,
        // so put the source back as readable text rather than leaving blanks.
        Array.prototype.forEach.call(container.querySelectorAll(".mermaid"), function (el) {
          var pre = document.createElement("pre");
          pre.className = "mermaid-unavailable";
          pre.textContent = el.textContent;
          el.replaceWith(pre);
        });
      });
  }

  // ------------------------------------------------------------ fullscreen

  function toggleFullscreen() {
    // A webview lives in an iframe that may not be allowed to go fullscreen.
    // When the request is refused, fall back to dropping the card's gutters so
    // the deck at least fills the panel.
    if (!document.fullscreenElement) {
      var attempt = document.documentElement.requestFullscreen
        ? document.documentElement.requestFullscreen()
        : Promise.reject();
      Promise.resolve(attempt).catch(function () {
        document.body.classList.toggle("is-fullscreen");
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    } else {
      document.body.classList.remove("is-fullscreen");
    }
  }

  document.addEventListener("fullscreenchange", function () {
    document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });

  // ------------------------------------------------------------- shortcuts

  var dialog = document.getElementById("shortcuts-dialog");

  function openDialog() {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  if (dialog) {
    dialog.addEventListener("click", function (e) {
      var rect = dialog.getBoundingClientRect();
      var inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) closeDialog();
    });
  }

  // ----------------------------------------------------------------- input

  document.addEventListener("keydown", function (e) {
    var dialogOpen = dialog && dialog.open;

    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (dialogOpen) closeDialog();
      else openDialog();
      return;
    }

    // While the cheat sheet is up, Escape closes it and nothing else moves.
    if (dialogOpen) {
      return;
    }

    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      show(current + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      show(current - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      show(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      show(screens.length - 1, true);
    } else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleFullscreen();
    } else if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleTheme();
    }
  });

  if (prevBtn) prevBtn.addEventListener("click", function () { show(current - 1, true); });
  if (nextBtn) nextBtn.addEventListener("click", function () { show(current + 1, true); });
  if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);

  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  var openBtn = document.getElementById("shortcuts-toggle");
  if (openBtn) {
    openBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openDialog();
    });
  }

  var closeBtn = document.getElementById("shortcuts-close");
  if (closeBtn) closeBtn.addEventListener("click", closeDialog);

  // ----------------------------------------------------- host messages

  window.addEventListener("message", function (event) {
    var message = event.data;
    if (!message) return;

    if (message.type === "update") {
      // Swapping the slides in place, rather than reloading, is what lets the
      // deck stay on the slide you are editing while you type. Clamping keeps
      // that position meaningful when the edit removed slides below it.
      container.innerHTML = message.html;
      collect();
      show(Math.min(current, Math.max(0, screens.length - 1)), false);
      renderMermaid();
      return;
    }

    if (message.type === "goto" && typeof message.index === "number") {
      show(message.index, false);
    }
  });

  // ------------------------------------------------------------- start up

  applyTheme();
  collect();

  var saved = host ? host.getState() : null;
  show(saved && typeof saved.index === "number" ? saved.index : 0, false);
  renderMermaid();
})();
