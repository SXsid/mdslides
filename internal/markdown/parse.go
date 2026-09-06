package markdown

import (
	"bytes"
	"fmt"
	"html/template"
	"os"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/text"
)

// ParseFile reads path and parses it. It exists only to keep file I/O out
// of Parse, so Parse itself can be tested on in-memory byte slices without
// touching disk.
func ParseFile(path string) (Deck, error) {
	source, err := os.ReadFile(path)
	if err != nil {
		return Deck{}, fmt.Errorf("read %s: %w", path, err)
	}
	return Parse(source)
}

// Parse turns raw Markdown source into a Deck: every H1 heading starts a
// new Slide, and a thematic break (---) starts a new Page within the
// current Slide — an explicit, author-controlled alternative to letting
// the layout engine decide every page boundary by image count alone.
//
// Standalone-image extraction is still a later step: for now every block
// (including images) renders straight through into the current Page's
// ContentHTML.
func Parse(source []byte) (Deck, error) {
	md := goldmark.New()
	doc := md.Parser().Parse(text.NewReader(source))

	var deck Deck
	var current *Slide
	var pages []Page
	var body bytes.Buffer

	// flushPage closes out whatever content has accumulated for the page
	// in progress. It's a deliberate no-op on an empty buffer, so a
	// thematic break with nothing before it (right after a heading, or
	// right after another thematic break) doesn't manufacture a blank
	// page — there's nothing to "break" yet.
	flushPage := func() {
		if body.Len() == 0 {
			return
		}
		pages = append(pages, Page{ContentHTML: template.HTML(body.String())})
		body.Reset()
	}

	// flushSlide closes out the slide in progress. Unlike flushPage, it
	// guarantees at least one Page even if the slide had zero content —
	// a heading the author just started should still appear in the deck,
	// not silently vanish because there's nothing under it yet.
	flushSlide := func() {
		if current == nil {
			return
		}
		flushPage()
		if len(pages) == 0 {
			pages = []Page{{}}
		}
		current.Pages = pages
		deck.Slides = append(deck.Slides, *current)
		pages = nil
	}

	for n := doc.FirstChild(); n != nil; n = n.NextSibling() {
		if h, ok := n.(*ast.Heading); ok && h.Level == 1 {
			flushSlide()
			heading := headingText(h, source)
			if deck.Title == "" {
				deck.Title = heading
			}
			headingHTML, err := renderInlineChildren(md.Renderer(), source, h)
			if err != nil {
				return Deck{}, fmt.Errorf("render heading %q: %w", heading, err)
			}
			current = &Slide{Heading: heading, HeadingHTML: headingHTML}
			continue
		}
		if _, ok := n.(*ast.ThematicBreak); ok {
			flushPage()
			continue
		}
		if current == nil {
			// Content before the first H1 has no slide to belong to.
			// Skip it rather than inventing an untitled slide for it.
			continue
		}
		if err := md.Renderer().Render(&body, source, n); err != nil {
			return Deck{}, fmt.Errorf("render block under slide %q: %w", current.Heading, err)
		}
	}
	flushSlide()

	return deck, nil
}

// headingText collects a heading's inline text content, discarding any
// emphasis/formatting markup — e.g. "## *Setup*" becomes "Setup".
func headingText(h *ast.Heading, source []byte) string {
	var buf bytes.Buffer
	for n := h.FirstChild(); n != nil; n = n.NextSibling() {
		collectText(n, source, &buf)
	}
	return buf.String()
}

// renderInlineChildren renders a block node's inline children (text,
// emphasis, links, code spans, ...) to HTML without the block's own
// wrapping tag — e.g. for a Heading node this yields "<em>Setup</em>", not
// "<h1><em>Setup</em></h1>". The caller decides the wrapping tag and CSS
// class, since that's presentation, not content.
func renderInlineChildren(r renderer.Renderer, source []byte, block ast.Node) (template.HTML, error) {
	var buf bytes.Buffer
	for n := block.FirstChild(); n != nil; n = n.NextSibling() {
		if err := r.Render(&buf, source, n); err != nil {
			return "", err
		}
	}
	return template.HTML(buf.String()), nil
}

func collectText(n ast.Node, source []byte, buf *bytes.Buffer) {
	if t, ok := n.(*ast.Text); ok {
		buf.Write(t.Segment.Value(source))
		return
	}
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		collectText(c, source, buf)
	}
}
