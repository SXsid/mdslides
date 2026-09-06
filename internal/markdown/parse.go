package markdown

import (
	"bytes"
	"fmt"
	"html/template"
	"os"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
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
// new Slide, and every other top-level block under that heading is
// rendered as-is into that Slide's single Page.
//
// This is step 1 of the parser: it proves the tree-walk finds slide
// boundaries correctly. Thematic-break page splitting and standalone-image
// extraction are deliberately not handled yet — they're separate, later
// changes to this same function so each behavior can be tested in
// isolation.
func Parse(source []byte) (Deck, error) {
	md := goldmark.New()
	doc := md.Parser().Parse(text.NewReader(source))

	var deck Deck
	var current *Slide
	var body bytes.Buffer

	flush := func() {
		if current == nil {
			return
		}
		current.Pages = []Page{{ContentHTML: template.HTML(body.String())}}
		deck.Slides = append(deck.Slides, *current)
		body.Reset()
	}

	for n := doc.FirstChild(); n != nil; n = n.NextSibling() {
		if h, ok := n.(*ast.Heading); ok && h.Level == 1 {
			flush()
			heading := headingText(h, source)
			if deck.Title == "" {
				deck.Title = heading
			}
			current = &Slide{Heading: heading}
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
	flush()

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

func collectText(n ast.Node, source []byte, buf *bytes.Buffer) {
	if t, ok := n.(*ast.Text); ok {
		buf.Write(t.Segment.Value(source))
		return
	}
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		collectText(c, source, buf)
	}
}
