# Architecture

How mdslides is put together, and why the package boundaries are where
they are. Read [`../README.md`](../README.md) first for what the tool
does; this doc is for understanding or extending the code itself. Design
rationale for the product decisions (not the code structure) is in
[`HLD.md`](HLD.md).

## Pipeline

```
[file.md]
    v
markdown.ParseFile   -- goldmark (+GFM: tables, strikethrough, task lists)
                         AST walk. Emits a Deck: Slides, each with one or
                         more Pages (text + standalone images).
    v
layout.Classify      -- pure function: image count -> grid shape (Kind).
    v
render.HTML          -- Deck + layout decisions -> one HTML document.
    v
server.Server        -- serves that HTML, watches the file, pushes
                         "reload" over SSE when it changes.
    v
[browser + web/js/*.js] -- nav (keyboard/hash), theme (light/dark toggle),
                            live-reload (SSE client), diagrams (renders
                            ```mermaid fences into SVG via a CDN import)
```

The five browser-side scripts (`internal/render/web/js/`) are ES modules
that only `main.js` imports together — `nav.js` manages keyboard and hash
routing, `theme.js` controls color palettes, `live-reload.js` connects to
the SSE stream, `diagrams.js` initializes Mermaid graphics, and
`shortcuts.js` handles the keyboard cheat sheet modal dialog. Same
"one file per concern" principle as the Go packages, applied to the frontend.

**The dependency direction only ever goes one way, top to bottom:**
`server` imports `render` and `markdown` and defines its own
`SourceWatcher`; `render` imports `markdown` and `layout`; `layout` and
`markdown` import nothing of each other, or of anything below them. Nothing
downstream is ever imported by something upstream. That's not a style
preference — it's what makes each package testable by itself: `layout`'s
tests don't need a Markdown file, `markdown`'s tests don't need HTML, and
`server`'s tests don't need a real filesystem (see the interface note
below).

**Why each boundary is where it is:**
- `internal/markdown` is the only package that knows Markdown syntax
  exists. It hands everything else a plain `Deck` of Go structs.
- `internal/layout` knows nothing about Markdown, HTML, or HTTP — `Classify`
  is a pure function of an integer, on purpose, so every case is
  exhaustively unit-tested and nothing needs to import it just to reuse the
  logic.
- `internal/render` is the only package that knows HTML exists. It's also
  the only package that imports *both* `markdown` and `layout` — that's
  deliberate: deciding what to do with a page that has more images than
  fit one grid (`layout.MaxPerPage`) happens here, at render time, not in
  the parser. If the parser had to ask the layout engine "how many images
  fit," that would be a dependency running backward against the data flow.
- `internal/server` is the only package that knows HTTP, SSE, and
  filesystem watching exist. `cmd/mdslides/main.go` does nothing but parse
  flags and wire this together — if real logic starts accumulating in
  `main.go`, that's the signal something is in the wrong package.

## The one interface in this codebase

Go idiom is "accept interfaces, return structs" — but that's not a rule to
apply everywhere; it's a rule for exactly the situation where a second
implementation is real. Here, that's file watching:

```go
type SourceWatcher interface {
    Changes() <-chan struct{}
    Close() error
}
```

`server.Server` depends on this interface, not on `fsnotify` directly. The
real implementation (`NewFSWatcher`, in `internal/server/watch.go`) wraps
`fsnotify`; `internal/server/watch_test.go` uses a `fakeWatcher` that
satisfies the same interface and lets a test fire a "changed" event on
command — no real file, no waiting on real filesystem event timing.

`layout` and `markdown` deliberately have **no** interfaces: there's only
ever one way to "parse markdown" or "classify an image count" in this
program, and an interface with one implementation is decoration, not
design. The contrast is the lesson — reach for an interface where a second
implementation is real (a fake for tests, or a genuine alternative), not by
default.

## Request lifecycle

1. Browser requests `GET /`.
2. `server.handleIndex` calls `markdown.ParseFile(path)` — re-parsed fresh
   every request. Wasteful at scale; correct here, because live-reload
   needs zero cache invalidation logic this way — the next request just
   sees whatever is on disk now.
3. `render.HTML(deck)` walks every `Slide`'s `Page`s. A page within
   `layout.MaxPerPage` (4) images renders as one `<section>`; beyond that,
   the extra images become their own images-only "(cont.)" screens
   (`render.screensForPage`).
4. The browser gets one HTML document with every screen already in it;
   `nav.js` toggles which `.screen` has the `.active` class based on
   arrow-key/space input and the `#/<n>` URL hash.
5. Separately, `live-reload.js` opens `GET /events` (Server-Sent Events).
   `server.handleEvents` blocks on `SourceWatcher.Changes()`; `NewFSWatcher`
   watches the file's *directory*, not the file itself, because editors
   that save via write-temp-then-rename (vim included) replace the inode a
   direct file watch points at, silently killing it after the first save.
   On a change, the server pushes `data: reload`, and `live-reload.js` reloads
   the page.

## Exercises

Sized to exercise a specific skill each, meant for you to implement:

1. **Warm-up.** Add a table-driven case for a 5-image slide to
   `internal/layout/layout_test.go` confirming it still clamps to `Bento4`.
   Confirms you can follow the existing pattern before changing anything.
2. **CLI flag → data flow.** Add a `-start <n>` flag to `main.go` that
   opens the deck on slide `n` instead of slide 0 — thread it through
   `render.HTML` into the template (an initial value the template embeds
   for `js/nav.js` to read on load, instead of always defaulting to the
   `#/0` hash). No new packages needed, just follow one value through the
   pipeline that already exists.
3. **Second interface implementation.** Add a polling-based fallback
   `SourceWatcher` (stat the file on a ticker, compare mtimes) for
   filesystems where `fsnotify` misbehaves (some network mounts), selected
   with a flag. This is the exercise that actually uses the interface
   boundary — right now there's only ever been one real implementation.
4. **New feature along existing seams.** Speaker notes: parse a trailing
   `<!-- note: ... -->` HTML comment out of a slide in `internal/markdown`,
   carry it as a new `Slide.Notes` field, render it into a toggle-able pane
   in `viewer.js`. Touches three packages along their existing boundaries —
   a good test of whether the separation actually holds up under a real
   change, or whether it turns out you need to reach across a boundary
   that shouldn't exist.
5. **Bridge to "later."** A five-line VS Code `tasks.json` (or Neovim
   keymap) that shells out to the built `mdslides` binary on the current
   file. The on-ramp to a real extension/plugin, once this is solid.
