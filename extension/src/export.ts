import * as path from "node:path";
import * as vscode from "vscode";
import { parse } from "./deck/parse";
import { renderDeck } from "./deck/render";

/**
 * Per-image ceiling for inlining. Above this an image stays a relative path:
 * a 30 MB photo turned into base64 makes a ~40 MB HTML file that most browsers
 * choke on, and a deck full of them would be unusable. The report tells the
 * author exactly which images stayed external so they know what to ship
 * alongside the file.
 */
const MAX_INLINE_BYTES = 4 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

export interface ExportResult {
  target: vscode.Uri;
  slides: number;
  /** Images left as relative paths because they were too large to inline. */
  external: string[];
}

/**
 * Writes the deck as one self-contained HTML file: stylesheets and viewer
 * script inlined, images embedded as data URIs where they are small enough.
 * The result opens in any browser with no server and no mdslides install,
 * which is the form a deck usually needs to be in to get sent to someone.
 */
export async function exportDeck(
  context: vscode.ExtensionContext,
  source: vscode.Uri,
  target: vscode.Uri
): Promise<ExportResult> {
  const bytes = await vscode.workspace.fs.readFile(source);
  const text = Buffer.from(bytes).toString("utf8");

  const baseDir = source.scheme === "file" ? path.dirname(source.fsPath) : undefined;
  const external: string[] = [];
  const cache = new Map<string, string>();

  // Inlining needs to read files, and the Markdown renderer is synchronous, so
  // the reads happen in one pass up front and the resolver is a cache lookup.
  const candidates = collectImagePaths(text);
  for (const candidate of candidates) {
    if (!baseDir || hasScheme(candidate)) {
      continue;
    }
    const absolute = path.resolve(baseDir, candidate.replace(/^\//, ""));
    const mime = MIME_BY_EXT[path.extname(absolute).toLowerCase()];
    if (!mime) {
      continue;
    }
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absolute));
      if (stat.size > MAX_INLINE_BYTES) {
        external.push(candidate);
        continue;
      }
      const data = await vscode.workspace.fs.readFile(vscode.Uri.file(absolute));
      cache.set(candidate, `data:${mime};base64,${Buffer.from(data).toString("base64")}`);
    } catch {
      // A broken link in the source. It stays broken in the export rather than
      // failing the whole thing — the author can see it on the slide.
      external.push(candidate);
    }
  }

  const deck = parse(text, { resolveSrc: (src) => cache.get(src) ?? src });
  const rendered = renderDeck(deck);

  const media = (...parts: string[]) =>
    vscode.Uri.joinPath(context.extensionUri, "media", ...parts);
  const css = (
    await Promise.all(
      [
        media("css", "tokens.css"),
        media("css", "layouts.css"),
        media("css", "viewer.css"),
        media("webview.css"),
      ].map(readText)
    )
  ).join("\n");
  const js = await readText(media("webview.js"));

  const mermaid = vscode.workspace.getConfiguration("mdslides").get<boolean>("mermaid", true);
  const html = standalone(rendered.title, rendered.html, css, js, mermaid);
  await vscode.workspace.fs.writeFile(target, Buffer.from(html, "utf8"));

  return { target, slides: rendered.screens.length, external };
}

async function readText(uri: vscode.Uri): Promise<string> {
  return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
}

function hasScheme(src: string): boolean {
  return src.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(src);
}

/**
 * Pulls every image target out of the source with a scan rather than a parse.
 * The list only decides which files to read ahead of time — the real parse
 * still decides what actually renders — so over-collecting is harmless and a
 * missed exotic case just means that image is not inlined.
 */
function collectImagePaths(source: string): string[] {
  const found = new Set<string>();
  const markdown = /!\[[^\]]*\]\(\s*<?([^>\s)]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  const html = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  for (const re of [markdown, html]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      found.add(m[1]);
    }
  }
  return [...found];
}

function standalone(
  title: string,
  screens: string,
  css: string,
  js: string,
  mermaid: boolean
): string {
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || "Deck")}</title>
${fonts}
<style>
${css}
</style>
</head>
<body data-theme-mode="auto" data-mermaid="${mermaid ? "on" : "off"}" data-standalone="true">
<div id="stage">
<div id="deck">
<div id="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
<div id="screens">
${screens}
</div>
</div>
</div>

<nav id="hud" aria-label="Deck controls">
  <div class="hud-group">
    <button id="nav-prev" class="hud-btn" type="button" title="Previous slide (Left Arrow)" aria-label="Previous slide">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <span id="counter" aria-live="polite"></span>
    <button id="nav-next" class="hud-btn" type="button" title="Next slide (Right Arrow / Space)" aria-label="Next slide">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
  </div>
  <div class="hud-separator"></div>
  <div class="hud-group">
    <button id="fullscreen-toggle" class="hud-btn" type="button" title="Toggle fullscreen (F)" aria-label="Toggle fullscreen">
      <svg class="icon-expand" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
      <svg class="icon-compress" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
    </button>
    <button id="theme-toggle" class="hud-btn" type="button" title="Toggle light/dark theme (T)" aria-label="Toggle light/dark theme">
      <svg class="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      <svg class="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
    </button>
    <button id="shortcuts-toggle" class="hud-btn" type="button" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    </button>
  </div>
</nav>

<dialog id="shortcuts-dialog" aria-labelledby="shortcuts-title">
  <div class="dialog-content">
    <div class="dialog-header">
      <h2 id="shortcuts-title">Keyboard Navigation</h2>
      <button id="shortcuts-close" class="dialog-close" type="button" aria-label="Close shortcuts guide">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="dialog-body">
      <table class="shortcuts-table">
        <tbody>
          <tr><td><kbd>&rarr;</kbd> / <kbd>Space</kbd></td><td>Next slide</td></tr>
          <tr><td><kbd>&larr;</kbd></td><td>Previous slide</td></tr>
          <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>First / Last slide</td></tr>
          <tr><td><kbd>F</kbd></td><td>Toggle fullscreen presentation</td></tr>
          <tr><td><kbd>T</kbd></td><td>Toggle dark / light theme</td></tr>
          <tr><td><kbd>?</kbd></td><td>Toggle keyboard shortcut cheat sheet</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Close shortcuts cheat sheet</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</dialog>

<script>
${js}
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
