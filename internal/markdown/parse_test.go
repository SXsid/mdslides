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
