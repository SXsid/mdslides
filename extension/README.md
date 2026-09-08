# mdslides for VS Code

Turn a Markdown file into a live PPT-style deck without leaving the editor.
Every `#` heading is a slide, `---` forces a page break, and standalone images
are arranged into bento grids automatically — the same rules as the
[mdslides CLI](https://github.com/SXsid/mdslides), rendering the same markup
through the same stylesheets.

## What it does

- **Deck preview beside your editor.** Open a Markdown file and click the
  preview icon in the editor title bar, or run **mdslides: Open Deck Preview to
  the Side**.
- **Updates as you type.** The CLI reloads the browser on file save; the
  extension reads the editor buffer, so the deck follows unsaved edits — and it
  swaps slides in place rather than reloading, so you keep your position.
- **The cursor drives the deck.** Move the caret in the Markdown and the
  preview jumps to the slide that text belongs to. Turn it off with
  `mdslides.syncCursor`.
- **Export a standalone deck.** **mdslides: Export Deck to Standalone HTML…**
  writes one self-contained file — CSS and viewer script inlined, images
  embedded as data URIs — that opens in any browser with no server and no
  mdslides install.

## Authoring

The authoring rules are the CLI's, unchanged — see
[docs/AUTHORING.md](https://github.com/SXsid/mdslides/blob/main/docs/AUTHORING.md).
In short:

| You write | You get |
| --- | --- |
| `# Heading` | A new slide |
| `---` | A manual page break inside the current slide |
| A paragraph of only images | Images pulled out into a grid (1 → split, 2 → stack, 3 → bento-3, 4 → 2×2) |
| More than 4 images on a page | Continuation slides, heading repeated with "(cont.)" |
| Anything else | Normal GitHub Flavored Markdown |

Content above the first `#` heading has no slide to belong to and is skipped.

## Keyboard

| Key | Action |
| --- | --- |
| <kbd>→</kbd> / <kbd>Space</kbd> / <kbd>PageDown</kbd> | Next slide |
| <kbd>←</kbd> / <kbd>PageUp</kbd> | Previous slide |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last slide |
| <kbd>F</kbd> | Fullscreen |
| <kbd>T</kbd> | Light / dark override |
| <kbd>?</kbd> | Shortcut cheat sheet |

The commands ship without default keybindings so they cannot collide with
VS Code's built-in Markdown preview. To bind one, open **Preferences: Open
Keyboard Shortcuts** and search for `mdslides`.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `mdslides.syncCursor` | `true` | Jump the preview to the slide containing the cursor |
| `mdslides.theme` | `auto` | `auto` follows your VS Code theme; `light` / `dark` force one |
| `mdslides.mermaid` | `true` | Render ` ```mermaid ` blocks as diagrams (loads Mermaid from a CDN) |
| `mdslides.webFonts` | `true` | Load Space Grotesk / Inter / JetBrains Mono from Google Fonts |

Both `mermaid` and `webFonts` reach the network. Turn them off to keep the
preview entirely local — diagrams fall back to their source text and the deck
falls back to system fonts.

## How this relates to the CLI

The extension does **not** shell out to the `mdslides` binary, and you do not
need it installed. `src/deck/` is a TypeScript port of `internal/markdown`,
`internal/layout` and `internal/render` — same slide rules, same layout
classification, same `.screen.layout-*` markup. Bundling six platform binaries
would have been the alternative, and it would have broken Remote SSH,
Dev Containers and vscode.dev, where the extension host is not on the machine
you are looking at.

The stylesheets are not duplicated: `scripts/sync-assets.mjs` copies
`internal/render/web/css/*.css` into `media/css/` on every build, so the deck's
appearance has exactly one source of truth. The viewer JS *is* adapted rather
than copied, because the CLI's version talks to a local HTTP server (ES module
imports from `/static/`, an `EventSource` on `/events`) and a webview has
neither.

## Development

```bash
cd extension
npm install
npm run watch      # esbuild in watch mode
```

Then press <kbd>F5</kbd> in VS Code to launch an Extension Development Host, and
open a Markdown file in it.

```bash
npm run typecheck    # tsc --noEmit
npm run compile      # sync CSS + bundle to dist/
npm run vsce-package # produce a .vsix
```

The extension must live inside the mdslides repo — the build reads the viewer
CSS out of the Go module next to it.

## License

MIT, same as the rest of the repo.
