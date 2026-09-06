package markdown

import (
	"strings"
	"testing"
)

func TestParse_SplitsOnH1(t *testing.T) {
	source := []byte(`# First
Some intro text.

# Second
More text here.
`)
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 2 {
		t.Fatalf("got %d slides, want 2", len(deck.Slides))
	}
	if deck.Slides[0].Heading != "First" {
		t.Errorf("slide 0 heading = %q, want %q", deck.Slides[0].Heading, "First")
	}
	if deck.Slides[1].Heading != "Second" {
		t.Errorf("slide 1 heading = %q, want %q", deck.Slides[1].Heading, "Second")
	}
	if got := string(deck.Slides[0].Pages[0].ContentHTML); !strings.Contains(got, "Some intro text.") {
		t.Errorf("slide 0 content = %q, want it to contain the intro text", got)
	}
}

func TestParse_ContentBeforeFirstHeadingIsSkipped(t *testing.T) {
	source := []byte("Stray paragraph with no heading.\n\n# Only\nBody.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 1 {
		t.Fatalf("got %d slides, want 1", len(deck.Slides))
	}
	if strings.Contains(string(deck.Slides[0].Pages[0].ContentHTML), "Stray paragraph") {
		t.Errorf("stray pre-heading content leaked into the slide: %q", deck.Slides[0].Pages[0].ContentHTML)
	}
}

func TestParse_EmptySourceProducesNoSlides(t *testing.T) {
	deck, err := Parse([]byte(""))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 0 {
		t.Errorf("got %d slides, want 0", len(deck.Slides))
	}
}

func TestParse_HeadingKeepsFormattingInHTMLButNotInPlainText(t *testing.T) {
	source := []byte("# *Setup* and `config`\nBody.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	slide := deck.Slides[0]
	if slide.Heading != "Setup and config" {
		t.Errorf("Heading = %q, want plain text %q", slide.Heading, "Setup and config")
	}
	html := string(slide.HeadingHTML)
	if !strings.Contains(html, "<em>Setup</em>") {
		t.Errorf("HeadingHTML = %q, want it to contain <em>Setup</em>", html)
	}
	if !strings.Contains(html, "<code>config</code>") {
		t.Errorf("HeadingHTML = %q, want it to contain <code>config</code>", html)
	}
	if strings.Contains(html, "<h1") {
		t.Errorf("HeadingHTML = %q, should not include the outer <h1> — that's the renderer's job", html)
	}
}

func TestParse_ThematicBreakStartsNewPage(t *testing.T) {
	source := []byte("# Title\nPage one text.\n\n---\n\nPage two text.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 1 {
		t.Fatalf("got %d slides, want 1", len(deck.Slides))
	}
	pages := deck.Slides[0].Pages
	if len(pages) != 2 {
		t.Fatalf("got %d pages, want 2", len(pages))
	}
	if !strings.Contains(string(pages[0].ContentHTML), "Page one text.") {
		t.Errorf("page 0 = %q, want it to contain %q", pages[0].ContentHTML, "Page one text.")
	}
	if strings.Contains(string(pages[0].ContentHTML), "Page two text.") {
		t.Errorf("page 0 = %q, page two text leaked into it", pages[0].ContentHTML)
	}
	if !strings.Contains(string(pages[1].ContentHTML), "Page two text.") {
		t.Errorf("page 1 = %q, want it to contain %q", pages[1].ContentHTML, "Page two text.")
	}
}

func TestParse_LeadingThematicBreakIsNoOp(t *testing.T) {
	source := []byte("# Title\n\n---\n\nBody.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	pages := deck.Slides[0].Pages
	if len(pages) != 1 {
		t.Fatalf("got %d pages, want 1 (leading --- should not create a blank page)", len(pages))
	}
	if !strings.Contains(string(pages[0].ContentHTML), "Body.") {
		t.Errorf("page 0 = %q, want it to contain %q", pages[0].ContentHTML, "Body.")
	}
}

func TestParse_ConsecutiveThematicBreaksCollapse(t *testing.T) {
	source := []byte("# Title\nA.\n\n---\n\n---\n\nB.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	pages := deck.Slides[0].Pages
	if len(pages) != 2 {
		t.Fatalf("got %d pages, want 2 (the second --- had nothing to break)", len(pages))
	}
}

func TestParse_HeadingWithNoContentStillYieldsOnePage(t *testing.T) {
	source := []byte("# Empty Title\n\n# Next\nBody.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 2 {
		t.Fatalf("got %d slides, want 2", len(deck.Slides))
	}
	if len(deck.Slides[0].Pages) != 1 {
		t.Fatalf("empty slide got %d pages, want 1 (heading should stay visible)", len(deck.Slides[0].Pages))
	}
}

func TestParse_StandaloneImageIsPulledOutOfContent(t *testing.T) {
	source := []byte("# Title\n![a diagram](diagram.png)\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	page := deck.Slides[0].Pages[0]
	if len(page.Images) != 1 {
		t.Fatalf("got %d images, want 1", len(page.Images))
	}
	if page.Images[0].Src != "diagram.png" || page.Images[0].Alt != "a diagram" {
		t.Errorf("image = %+v, want Src=diagram.png Alt=%q", page.Images[0], "a diagram")
	}
	if strings.Contains(string(page.ContentHTML), "<img") {
		t.Errorf("ContentHTML = %q, standalone image should not also render inline", page.ContentHTML)
	}
}

func TestParse_ConsecutiveImagesInOneParagraphAllExtracted(t *testing.T) {
	source := []byte("# Title\n![a](1.png)\n![b](2.png)\n![c](3.png)\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	page := deck.Slides[0].Pages[0]
	if len(page.Images) != 3 {
		t.Fatalf("got %d images, want 3 (consecutive lines, no blank line, should all count)", len(page.Images))
	}
}

func TestParse_InlineImageInsideSentenceStaysInline(t *testing.T) {
	source := []byte("# Title\nSee the ![icon](icon.png) next to this word.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	page := deck.Slides[0].Pages[0]
	if len(page.Images) != 0 {
		t.Fatalf("got %d extracted images, want 0 (image is inside a sentence, not standalone)", len(page.Images))
	}
	if !strings.Contains(string(page.ContentHTML), "<img") {
		t.Errorf("ContentHTML = %q, want the inline image to still render in place", page.ContentHTML)
	}
}

func TestParse_ImagesFirstReflectsSourceOrder(t *testing.T) {
	imageFirst, err := Parse([]byte("# Title\n![a](1.png)\n\nSome text after.\n"))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if !imageFirst.Slides[0].Pages[0].ImagesFirst {
		t.Errorf("ImagesFirst = false, want true when the image comes before the text")
	}

	textFirst, err := Parse([]byte("# Title\nSome text before.\n\n![a](1.png)\n"))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if textFirst.Slides[0].Pages[0].ImagesFirst {
		t.Errorf("ImagesFirst = true, want false when the text comes before the image")
	}
}

func TestParse_H2DoesNotStartNewSlide(t *testing.T) {
	source := []byte("# Title\nIntro.\n\n## Subsection\nMore detail.\n")
	deck, err := Parse(source)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(deck.Slides) != 1 {
		t.Fatalf("got %d slides, want 1 (H2 should stay inside the H1 slide)", len(deck.Slides))
	}
	if got := string(deck.Slides[0].Pages[0].ContentHTML); !strings.Contains(got, "Subsection") {
		t.Errorf("expected H2 text to appear inside the slide content, got %q", got)
	}
}
