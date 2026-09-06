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
// new Slide, a thematic break (---) starts a new Page within the current
// Slide, and a paragraph containing nothing but image(s) is pulled out of
// the text flow into that Page's Images — everything else renders straight
// through as ContentHTML, unmodeled, via goldmark's own renderer.
func Parse(source []byte) (Deck, error) {
	md := goldmark.New()
	doc := md.Parser().Parse(text.NewReader(source))

	var deck Deck
	var current *Slide
	var pages []Page
	var body bytes.Buffer
	var pageImages []Image
	var pageImagesFirst bool
	var pageContentStarted bool // true once a non-image block has rendered into body

	// flushPage closes out whatever content has accumulated for the page
	// in progress. It's a deliberate no-op when there's neither text nor
	// images yet, so a thematic break with nothing before it (right after
	// a heading, or right after another thematic break) doesn't
	// manufacture a blank page.
	flushPage := func() {
		if body.Len() == 0 && len(pageImages) == 0 {
			return
		}
		pages = append(pages, Page{
			ContentHTML: template.HTML(body.String()),
			Images:      pageImages,
			ImagesFirst: pageImagesFirst,
		})
		body.Reset()
		pageImages = nil
		pageImagesFirst = false
		pageContentStarted = false
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
		if p, ok := n.(*ast.Paragraph); ok && isImageOnlyParagraph(p, source) {
			imgs := extractImages(p, source)
			if len(pageImages) == 0 {
				// Only the very first image (of the whole page) decides
				// ImagesFirst — later image-only paragraphs on the same
				// page just add more images, they don't change the order
				// decision that was already made.
				pageImagesFirst = !pageContentStarted
			}
			pageImages = append(pageImages, imgs...)
			continue
		}
		pageContentStarted = true
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

// isImageOnlyParagraph reports whether a paragraph is nothing but image(s)
// — no surrounding sentence, so it should be pulled out for the layout
// engine instead of staying inline in the text. This also matches multiple
// images written on consecutive lines with no blank line between them
// (a very natural way to type "here are 3 photos"): goldmark represents
// the line break between them as a Text node with an empty segment, not a
// separate node kind, so an empty/whitespace-only Text is still "image
// only" — any Text with real characters is not.
func isImageOnlyParagraph(p *ast.Paragraph, source []byte) bool {
	sawImage := false
	for n := p.FirstChild(); n != nil; n = n.NextSibling() {
		switch child := n.(type) {
		case *ast.Image:
			sawImage = true
		case *ast.Text:
			if len(bytes.TrimSpace(child.Segment.Value(source))) > 0 {
				return false
			}
		default:
			// A link wrapping the image, emphasis, etc. — treat as real
			// content for now rather than guessing it's decorative.
			return false
		}
	}
	return sawImage
}

// extractImages reads every Image child out of a paragraph already
// confirmed image-only by isImageOnlyParagraph.
func extractImages(p *ast.Paragraph, source []byte) []Image {
	var images []Image
	for n := p.FirstChild(); n != nil; n = n.NextSibling() {
		img, ok := n.(*ast.Image)
		if !ok {
			continue
		}
		var alt bytes.Buffer
		for c := img.FirstChild(); c != nil; c = c.NextSibling() {
			collectText(c, source, &alt)
		}
		images = append(images, Image{Src: string(img.Destination), Alt: alt.String()})
	}
	return images
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
