# mdslides kitchen sink

This deck exists to stress-test every Markdown feature the parser
supports in one place: tables, code blocks, blockquotes, nested lists,
task lists, strikethrough, links, and every image-count layout from 0
through overflow. If something looks wrong, this is the file to check
it against.

# Product overview

**mdslides** turns a Markdown file into a browser deck. Key ideas:

- Every `#` heading is a slide
- A `---` forces a manual page break
- Standalone images get pulled into a grid automatically
- ~~It requires a build step~~ — no bundler, no npm, just a Go binary

> "Write the doc once, present it without touching PowerPoint."
> — nobody, yet, but that's the idea

# Feature comparison

| Feature | mdslides | Slides/PPT | reveal.js |
|---|---|---|---|
| Source format | Markdown | Binary/XML | Markdown or HTML |
| Live reload | Yes | No | With a watcher |
| Build step | None | N/A | Sometimes |
| Image layout | Automatic | Manual | Manual |
| Runs offline | Yes | Yes | Yes |

# Roadmap

1. Parser: headings, page breaks, image extraction — **done**
2. Layout engine: count-based grid classification — **done**
3. Renderer + server: live-reload viewer — **done**
4. Editor integration:
   1. VS Code extension
   2. Neovim plugin
5. Polish:
   - [x] Light/dark theme
   - [x] Slide-change animation
   - [ ] Speaker notes
   - [ ] PDF export

# Setup

```bash
go build -o mdslides ./cmd/mdslides
./mdslides your-notes.md
```

Then edit `your-notes.md` in any editor — the browser tab updates on
save via [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

# One image

A single diagram sits beside this paragraph — the simplest non-trivial
layout case.

![system architecture](https://placehold.co/800x600?text=1+image)

# Two images

![before](https://placehold.co/600x400?text=before)
![after](https://placehold.co/600x400?text=after)

A before/after pair, stacked, with this caption alongside them.

# Three images, bento

![wide shot](https://placehold.co/700x500?text=3a)
![detail one](https://placehold.co/400x300?text=3b)
![detail two](https://placehold.co/400x300?text=3c)

One large image plus two smaller details — the bento-3 layout.

# Four images, 2x2 grid

![a](https://placehold.co/500x500?text=4a)
![b](https://placehold.co/500x500?text=4b)
![c](https://placehold.co/500x500?text=4c)
![d](https://placehold.co/500x500?text=4d)

Four images fill a 2x2 grid exactly, no overflow.

# Seven images overflow twice

![a](https://placehold.co/400x400?text=7a)
![b](https://placehold.co/400x400?text=7b)
![c](https://placehold.co/400x400?text=7c)
![d](https://placehold.co/400x400?text=7d)
![e](https://placehold.co/400x400?text=7e)
![f](https://placehold.co/400x400?text=7f)
![g](https://placehold.co/400x400?text=7g)

Seven images: a 2x2 grid, then one continuation page of 3 —
this caption should only appear on the first of the two.

# Manual page breaks

The first page of this section is just this sentence.

---

The second page, forced by `---` instead of an image-count split.

---

And a third page, to confirm consecutive breaks each start a fresh page.

# Nested lists and a blockquote together

- Parser
  - Splits on headings
  - Splits on thematic breaks
    - Even nested this deep
- Layout engine
  - Pure function of an image count

> Nesting three levels deep in a blockquote:
> - like this
>   - and this

# Inline formatting and a link

This sentence has *italic*, **bold**, ***bold italic***, `inline code`,
and a [link to the Go homepage](https://go.dev). ~~This part is struck
through.~~

# *Formatting* in the `heading` itself

Headings keep their inline formatting when displayed, even though
`Deck.Title` and `Slide.Heading` stay plain text underneath.
