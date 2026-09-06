package render

import (
	"html/template"
	"strings"
	"testing"

	"mdslides/internal/markdown"
)

func TestHTML_TitleAndTextOnlySlide(t *testing.T) {
	deck := markdown.Deck{
		Title: "My Deck",
		Slides: []markdown.Slide{
			{
				Heading:     "Intro",
				HeadingHTML: template.HTML("Intro"),
				Pages: []markdown.Page{
					{ContentHTML: template.HTML("<p>Hello.</p>")},
				},
			},
		},
	}

	out, err := HTML(deck)
	if err != nil {
		t.Fatalf("HTML: %v", err)
	}
	if !strings.Contains(out, "<title>My Deck</title>") {
		t.Errorf("output missing title, got: %s", out)
	}
	if !strings.Contains(out, "layout-text") {
		t.Errorf("output missing layout-text class for a 0-image page, got: %s", out)
	}
	if !strings.Contains(out, "<p>Hello.</p>") {
		t.Errorf("output missing slide content, got: %s", out)
	}
}

func TestHTML_OverflowImagesSplitIntoContinuationScreens(t *testing.T) {
	images := make([]markdown.Image, 6)
	for i := range images {
		images[i] = markdown.Image{Src: string(rune('a'+i)) + ".png"}
	}
	deck := markdown.Deck{
		Slides: []markdown.Slide{
			{
				Heading:     "Gallery",
				HeadingHTML: template.HTML("Gallery"),
				Pages: []markdown.Page{
					{ContentHTML: template.HTML("<p>Caption.</p>"), Images: images},
				},
			},
		},
	}

	out, err := HTML(deck)
	if err != nil {
		t.Fatalf("HTML: %v", err)
	}

	// 6 images -> chunk of 4 (bento-4) + chunk of 2 (stack).
	if !strings.Contains(out, "layout-bento-4") {
		t.Errorf("expected a layout-bento-4 screen for the first 4 images, got: %s", out)
	}
	if !strings.Contains(out, "layout-stack") {
		t.Errorf("expected a layout-stack screen for the remaining 2 images, got: %s", out)
	}
	if !strings.Contains(out, "Gallery (cont.)") {
		t.Errorf("expected the continuation screen's heading to say '(cont.)', got: %s", out)
	}
	if strings.Count(out, "<p>Caption.</p>") != 1 {
		t.Errorf("expected the caption to appear exactly once, not repeated on the continuation screen, got: %s", out)
	}
	if strings.Count(out, "<img") != 6 {
		t.Errorf("expected all 6 images to appear across the two screens, got: %s", out)
	}
}

func TestHTML_ImagesFirstAddsClass(t *testing.T) {
	deck := markdown.Deck{
		Slides: []markdown.Slide{
			{
				Heading:     "Setup",
				HeadingHTML: template.HTML("Setup"),
				Pages: []markdown.Page{
					{
						ContentHTML: template.HTML("<p>Body.</p>"),
						Images:      []markdown.Image{{Src: "1.png"}},
						ImagesFirst: true,
					},
				},
			},
		},
	}

	out, err := HTML(deck)
	if err != nil {
		t.Fatalf("HTML: %v", err)
	}
	if !strings.Contains(out, "images-first") {
		t.Errorf("expected the images-first class when Page.ImagesFirst is true, got: %s", out)
	}
}

func TestChunkImages(t *testing.T) {
	imgs := []markdown.Image{{Src: "1"}, {Src: "2"}, {Src: "3"}, {Src: "4"}, {Src: "5"}}
	chunks := chunkImages(imgs, 4)
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2", len(chunks))
	}
	if len(chunks[0]) != 4 || len(chunks[1]) != 1 {
		t.Errorf("chunk sizes = %d, %d, want 4, 1", len(chunks[0]), len(chunks[1]))
	}
	if got := chunkImages(nil, 4); got != nil {
		t.Errorf("chunkImages(nil, 4) = %v, want nil", got)
	}
}
