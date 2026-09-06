// Renders ```mermaid fenced code blocks as real diagrams (flowcharts,
// sequence diagrams, and everything else Mermaid supports) instead of a
// plain code block. Loaded straight from a CDN as an ES module — Mermaid
// bundles its own layout engine and is a few MB, too large to vendor into
// a "just a small binary" tool, so this is the one piece of mdslides that
// needs internet access. Pin the version: an unpinned "latest" import
// could change behavior under you with no local diff to explain why.
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs";

export function init() {
  // goldmark renders a ```mermaid fence as <pre><code class="language-
  // mermaid">...</code></pre>. Mermaid's own render() instead expects a
  // plain element (no nested <code>) whose text content is the raw
  // diagram source — so swap each one for a <div class="mermaid"> before
  // handing anything to Mermaid.
  const blocks = document.querySelectorAll("pre > code.language-mermaid");
  if (blocks.length === 0) return;

  blocks.forEach(function (code) {
    const div = document.createElement("div");
    div.className = "mermaid";
    // .textContent, not .innerHTML: goldmark HTML-escapes the fenced
    // source (e.g. --> becomes --&gt;), and textContent decodes that
    // back to the literal characters Mermaid's parser expects.
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });

  // Match whichever theme is active when the page loads. This does NOT
  // update live if the user clicks the theme toggle afterward — doing
  // that would mean re-running mermaid.run() and diffing out the old
  // SVGs, which is more coordination with theme.js than this first pass
  // needs. Every screen reloads on its own anyway (live-reload on file
  // save), so the mismatch is short-lived in practice.
  const dark =
    document.documentElement.getAttribute("data-theme") === "dark" ||
    (!document.documentElement.getAttribute("data-theme") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
  mermaid.run();
}
