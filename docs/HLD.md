# mdslides — High-Level Design

Turn a Markdown file into a PPT-style browser deck. One H1 heading = one
slide; images get pulled out of the text flow and arranged automatically.

## Pipeline

```
[notes.md]
    v
Parser        -- goldmark AST walk. Emits ordered blocks (text/image),
                 splits on H1 (new Slide) AND on --- (explicit Page break
                 within a Slide, author-controlled)
    v
Layout Engine -- pure function of (image count, source order) -> grid shape.
                 Preserves whether images appeared before or after their
                 neighboring text in the source.
    v
Renderer      -- Deck struct -> HTML, one <section> per Page
    v
Server        -- serves HTML, watches the file, pushes live-reload over SSE
    v
Browser (client ES modules) -- keyboard nav between Pages, HUD, progress indicator
```

Each box owns exactly one kind of knowledge, and knowledge only flows
downward:
- **Parser** is the only box that knows Markdown syntax exists.
- **Layout Engine** knows nothing about Markdown or HTML — it's a pure
  function of an image count (and order), nothing else.
- **Renderer** is the only box that knows HTML exists.
- **Server** is the only box that knows HTTP/SSE/file-watching exist.

## Two design decisions worth calling out

1. **Why a real Markdown parser (goldmark) instead of splitting on lines
   ourselves.** Blank lines mean different things depending on context —
   inside a paragraph vs. inside a code fence vs. inside a list. Hand-rolling
   that is a bug farm. A real parser already builds a tree where "this is a
   paragraph," "this is a list," "this is a code block" are already decided
   correctly — we just walk the tree, we never reason about raw whitespace.

2. **Manual override, not just automatic layout.** Different authors put an
   image before its caption text or after it, and sometimes want to force a
   page break themselves rather than let the image-count heuristic decide.
   Two escape hatches: a `---` (thematic break) anywhere in a section forces
   a new Page, and the Layout Engine preserves image-before/after-text order
   from the source instead of always forcing text-left/image-right.

## Deferred (later pass)

VS Code extension and Neovim plugin — both just shell out to the `mdslides`
binary once it exists, so they're cheap to add after the CLI works.
