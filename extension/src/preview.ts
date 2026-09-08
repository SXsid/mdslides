import * as path from "node:path";
import * as vscode from "vscode";
import { parse } from "./deck/parse";
import { renderDeck, type RenderedDeck } from "./deck/render";
import { makeSrcResolver } from "./resolve";

/** Debounce for re-rendering while typing: long enough to coalesce a burst of
 *  keystrokes, short enough that the deck still feels like it tracks the
 *  cursor. Re-parsing is cheap (the CLI does it per HTTP request), so this is
 *  about avoiding wasted webview churn, not about parse cost. */
const RENDER_DEBOUNCE_MS = 120;

/**
 * One live deck preview bound to one Markdown document.
 *
 * The CLI's live reload is a file watcher plus an SSE reload — it can only
 * react to a save. Here the source is a TextDocument, so the preview follows
 * unsaved edits as they are typed, and the panel never actually reloads: the
 * screens are swapped in place so the viewer keeps its slide index.
 */
export class DeckPreview {
  /** Keyed by source document URI — one preview per file, refocused on repeat. */
  private static readonly open = new Map<string, DeckPreview>();

  private readonly disposables: vscode.Disposable[] = [];
  private renderTimer: NodeJS.Timeout | undefined;
  private lastRender: RenderedDeck | undefined;
  private currentIndex = 0;

  static async show(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    column: vscode.ViewColumn
  ): Promise<DeckPreview> {
    const key = uri.toString();
    const existing = DeckPreview.open.get(key);
    if (existing) {
      existing.panel.reveal(column, true);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      DeckPreview.viewType,
      DeckPreview.titleFor(uri),
      { viewColumn: column, preserveFocus: true },
      // retainContextWhenHidden is deliberately left off: the panel is cheap to
      // rebuild and restores its slide via getState/setState, so there is no
      // reason to hold a hidden webview's memory.
      DeckPreview.webviewOptions(context, uri)
    );

    const preview = new DeckPreview(context, uri, panel);
    DeckPreview.open.set(key, preview);
    await preview.render();
    return preview;
  }

  static readonly viewType = "mdslides.deckPreview";

  /**
   * Restores a preview that VS Code is reopening from a previous window
   * session. Without this the panel comes back as a blank webview, because its
   * HTML is generated at runtime rather than stored.
   */
  static restore(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    uri: vscode.Uri
  ): void {
    const key = uri.toString();
    if (DeckPreview.open.has(key)) {
      panel.dispose();
      return;
    }
    panel.webview.options = DeckPreview.webviewOptions(context, uri);
    const preview = new DeckPreview(context, uri, panel);
    DeckPreview.open.set(key, preview);
    void preview.render();
  }

  private static titleFor(uri: vscode.Uri): string {
    return `Deck: ${path.basename(uri.fsPath || uri.path)}`;
  }

  /**
   * localResourceRoots decides which files the webview may load. Images in a
   * deck are relative to the Markdown file, so its directory has to be in the
   * list; the workspace folder is included too so a deck can reference a
   * shared assets/ directory a level or two up.
   */
  private static webviewOptions(
    context: vscode.ExtensionContext,
    uri: vscode.Uri
  ): vscode.WebviewOptions {
    const roots = [vscode.Uri.joinPath(context.extensionUri, "media")];
    if (uri.scheme === "file") {
      roots.push(vscode.Uri.file(path.dirname(uri.fsPath)));
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      roots.push(folder.uri);
    }
    return { enableScripts: true, localResourceRoots: roots };
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly uri: vscode.Uri,
    private readonly panel: vscode.WebviewPanel
  ) {
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.svg");

    panel.onDidDispose(() => this.dispose(), null, this.disposables);

    panel.webview.onDidReceiveMessage(
      (message: { type: string; index?: number }) => {
        if (message.type === "navigated" && typeof message.index === "number") {
          this.currentIndex = message.index;
        }
      },
      null,
      this.disposables
    );

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === this.uri.toString()) {
          this.scheduleRender();
        }
      },
      null,
      this.disposables
    );

    // Covers edits made outside the editor (a script rewriting the file, a
    // git checkout) — onDidChangeTextDocument only fires for in-editor edits.
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.file(path.dirname(this.uri.fsPath)),
        path.basename(this.uri.fsPath)
      )
    );
    watcher.onDidChange(() => this.scheduleRender(), null, this.disposables);
    this.disposables.push(watcher);

    vscode.window.onDidChangeTextEditorSelection(
      (e) => this.syncFromCursor(e),
      null,
      this.disposables
    );

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration("mdslides")) {
          // Theme, fonts and Mermaid are all baked into the document shell, so
          // a config change means rebuilding it rather than swapping screens.
          void this.render({ rebuildShell: true });
        }
      },
      null,
      this.disposables
    );
  }

  private scheduleRender(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = undefined;
      void this.render();
    }, RENDER_DEBOUNCE_MS);
  }

  /**
   * Re-parses the source and updates the panel. The first call (and any config
   * change) writes the whole document shell; every later call posts only the
   * screens, so the webview keeps its slide position, scroll state and any
   * already-rendered Mermaid SVGs that did not change.
   */
  async render(options: { rebuildShell?: boolean } = {}): Promise<void> {
    let source: string;
    try {
      source = await this.readSource();
    } catch (err) {
      this.showError(`Could not read ${path.basename(this.uri.fsPath)}: ${errorText(err)}`);
      return;
    }

    let rendered: RenderedDeck;
    try {
      const deck = parse(source, {
        resolveSrc: makeSrcResolver(this.panel.webview, this.uri),
      });
      rendered = renderDeck(deck);
    } catch (err) {
      this.showError(`Could not render the deck: ${errorText(err)}`);
      return;
    }

    const first = this.lastRender === undefined;
    this.lastRender = rendered;

    if (first || options.rebuildShell) {
      this.panel.webview.html = this.shell(rendered);
      return;
    }

    await this.panel.webview.postMessage({
      type: "update",
      html: rendered.html,
      lines: rendered.screens.map((s) => s.line),
    });
  }

  /**
   * Prefers the in-editor text over the file on disk so the preview reflects
   * unsaved edits; falls back to disk for a document that is not currently
   * open (a preview left open after its editor was closed).
   */
  private async readSource(): Promise<string> {
    const open = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === this.uri.toString()
    );
    if (open) {
      return open.getText();
    }
    const bytes = await vscode.workspace.fs.readFile(this.uri);
    return Buffer.from(bytes).toString("utf8");
  }

  /**
   * Moves the preview to the slide the cursor is sitting in. Each screen
   * carries the source line its content started on, so this is a search for
   * the last screen at or above the cursor — the same thing a reader does
   * scrolling to "where am I in the deck".
   */
  private syncFromCursor(e: vscode.TextEditorSelectionChangeEvent): void {
    if (!vscode.workspace.getConfiguration("mdslides").get<boolean>("syncCursor", true)) {
      return;
    }
    if (e.textEditor.document.uri.toString() !== this.uri.toString()) {
      return;
    }
    const screens = this.lastRender?.screens;
    if (!screens || screens.length === 0) {
      return;
    }

    const line = e.selections[0].active.line;
    let index = 0;
    for (let i = 0; i < screens.length; i++) {
      if (screens[i].line <= line) {
        index = i;
      } else {
        break;
      }
    }
    if (index === this.currentIndex) {
      return;
    }
    this.currentIndex = index;
    void this.panel.webview.postMessage({ type: "goto", index });
  }

  private showError(message: string): void {
    this.panel.webview.html = errorShell(message);
  }

  /** Builds the full webview document: CSP, shared stylesheets, HUD, script. */
  private shell(rendered: RenderedDeck): string {
    const webview = this.panel.webview;
    const config = vscode.workspace.getConfiguration("mdslides");
    const mermaid = config.get<boolean>("mermaid", true);
    const webFonts = config.get<boolean>("webFonts", true);
    const theme = config.get<string>("theme", "auto");
    const nonce = makeNonce();

    const media = (...parts: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", ...parts));

    // Mermaid is an ES module pulled from a CDN — the CLI viewer does the same,
    // for the same reason: it bundles its own layout engine and is far too
    // large to vendor into a tool whose whole pitch is "one small binary".
    // Everything else here is local, so the CSP stays narrow when it is off.
    const scriptSrc = mermaid
      ? `'nonce-${nonce}' https://cdn.jsdelivr.net`
      : `'nonce-${nonce}'`;
    const styleSrc = webFonts
      ? `${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`
      : `${webview.cspSource} 'unsafe-inline'`;
    const fontSrc = webFonts ? `${webview.cspSource} https://fonts.gstatic.com` : webview.cspSource;

    const fontLink = webFonts
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">`
      : "";

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${styleSrc}; font-src ${fontSrc}; script-src ${scriptSrc}; connect-src https://cdn.jsdelivr.net;">
<title>${escapeHtml(rendered.title || "Deck")}</title>
${fontLink}
<link rel="stylesheet" href="${media("css", "tokens.css")}">
<link rel="stylesheet" href="${media("css", "layouts.css")}">
<link rel="stylesheet" href="${media("css", "viewer.css")}">
<link rel="stylesheet" href="${media("webview.css")}">
</head>
<body data-theme-mode="${escapeHtml(theme)}" data-mermaid="${mermaid ? "on" : "off"}" data-source="${escapeHtml(this.uri.toString())}">
<div id="stage">
<div id="deck">
<div id="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
<div id="screens">
${rendered.html}
</div>
</div>
</div>

<div id="empty-state" hidden>
  <p>No slides yet.</p>
  <p class="hint">Start a slide with a top-level heading:</p>
  <pre># My first slide</pre>
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

<script nonce="${nonce}" src="${media("webview.js")}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    DeckPreview.open.delete(this.uri.toString());
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}

function errorShell(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-errorForeground); padding: 2rem; }
</style>
</head>
<body><p>${escapeHtml(message)}</p></body>
</html>`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A per-load nonce is what lets the CSP allow this extension's own script
 *  while still refusing anything injected through the Markdown source. */
function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
