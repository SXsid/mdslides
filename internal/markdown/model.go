package markdown

import "html/template"

// Deck is the whole presentation: one H1 heading in the source becomes one
// Slide, in document order.
type Deck struct {
	Title  string
	Slides []Slide
}

// Slide is the content under one H1 heading. It usually renders as a single
// screen, but an author can split it into more than one Page by writing a
// thematic break (---), or the layout engine can split it automatically
// when there are too many images to fit one screen.
type Slide struct {
	// Heading is plain text, no markup — for consumers that can't hold
	// HTML: Deck.Title, a future URL anchor/slug, aria-labels, etc.
	Heading string
	// HeadingHTML is the same heading with inline formatting preserved
	// (emphasis, code spans, links) — for actually displaying the heading
	// on screen. Two fields because the two consumers have opposite
	// requirements: one must be a bare string, the other should look
	// like what the author wrote.
	HeadingHTML template.HTML
	Pages       []Page
}

// Page is exactly one screen the viewer will show. ContentHTML holds every
// "normal" Markdown block (paragraphs, lists, tables, code, ...) already
// rendered to HTML — this package never models those individually, it
// reuses goldmark's own renderer for anything it doesn't need to branch on.
// Images is only the *standalone* images (a paragraph containing nothing
// but one image), pulled out so the layout engine can arrange them instead
// of leaving them stuck inline in the text.
type Page struct {
	ContentHTML template.HTML
	Images      []Image
	// ImagesFirst is true when the images appeared before ContentHTML's
	// blocks in the source, so the renderer can preserve the author's
	// intended reading order instead of always forcing text-then-image.
	ImagesFirst bool
}

// Image is a single standalone image pulled out of the text flow.
type Image struct {
	Src string
	Alt string
}
