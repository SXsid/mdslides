package render

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"io/fs"

	"mdslides/internal/layout"
	"mdslides/internal/markdown"
)

//go:embed web/css web/js
var staticFiles embed.FS

// StaticAssets holds the embedded CSS/JS the viewer needs, rooted so that
// StaticAssets's "css/tokens.css" is web/css/tokens.css. The server mounts
// this under /static/ without needing to know anything about what's
// inside — HTTP routing doesn't require HTML/CSS/JS knowledge. Embedding
// the two directories (rather than listing every file) means a new CSS
// or JS file under web/css or web/js is picked up automatically, no
// go:embed edit needed.
var StaticAssets = mustSub(staticFiles, "web")

func mustSub(f embed.FS, dir string) fs.FS {
	sub, err := fs.Sub(f, dir)
	if err != nil {
		// Only reachable if the embed path above is wrong, which is a
		// compile-time-guaranteed-correct constant, not runtime input —
		// panicking here means "this is a bug in this package," the same
		// idiom as template.Must below.
		panic(err)
	}
	return sub
}

//go:embed web/page.html.tmpl
var templateFS embed.FS

var pageTemplate = template.Must(template.ParseFS(templateFS, "web/page.html.tmpl"))

// screen is the per-<section> data the template ranges over. The type
// itself doesn't need to be exported (only this package ever builds one),
// but its fields do — html/template reads them by reflection, which
// requires exported fields regardless of the type's own visibility.
type screen struct {
	Heading     template.HTML
	ContentHTML template.HTML
	Images      []markdown.Image
	Layout      string
	ImagesFirst bool
}

type document struct {
	Title   string
	Screens []screen
}

// HTML renders a full HTML document for the deck: every Slide's Pages
// become one or more <section> "screens". A Page with more images than
// layout.MaxPerPage is split into extra images-only continuation screens
// rather than overflowing one grid — see screensForPage.
func HTML(deck markdown.Deck) (string, error) {
	doc := document{Title: deck.Title}
	for _, slide := range deck.Slides {
		for _, page := range slide.Pages {
			doc.Screens = append(doc.Screens, screensForPage(slide.HeadingHTML, page)...)
		}
	}

	var buf bytes.Buffer
	if err := pageTemplate.Execute(&buf, doc); err != nil {
		return "", fmt.Errorf("execute page template: %w", err)
	}
	return buf.String(), nil
}

// screensForPage turns one markdown.Page into one or more rendered
// screens. A page within layout.MaxPerPage images is exactly one screen;
// beyond that, the extra images become their own images-only continuation
// screens, heading repeated with " (cont.)" and no text — repeating the
// same paragraph on every continuation screen was more confusing than
// just showing more images under the same heading.
func screensForPage(heading template.HTML, page markdown.Page) []screen {
	chunks := chunkImages(page.Images, layout.MaxPerPage)
	if len(chunks) == 0 {
		chunks = [][]markdown.Image{nil}
	}

	screens := make([]screen, 0, len(chunks))
	for i, images := range chunks {
		s := screen{
			Heading:     heading,
			Layout:      layout.Classify(len(images)).String(),
			Images:      images,
			ImagesFirst: page.ImagesFirst,
		}
		if i == 0 {
			s.ContentHTML = page.ContentHTML
		} else {
			s.Heading = heading + template.HTML(" (cont.)")
		}
		screens = append(screens, s)
	}
	return screens
}

// chunkImages splits images into groups of at most size, preserving
// order; an empty input or a non-positive size yields no chunks. The
// [:n:n] full slice expression caps each chunk's capacity at its length,
// so nothing downstream can accidentally grow one chunk into the next
// image's memory via append.
func chunkImages(images []markdown.Image, size int) [][]markdown.Image {
	if len(images) == 0 || size <= 0 {
		return nil
	}
	var chunks [][]markdown.Image
	for len(images) > 0 {
		n := size
		if n > len(images) {
			n = len(images)
		}
		chunks = append(chunks, images[:n:n])
		images = images[n:]
	}
	return chunks
}
